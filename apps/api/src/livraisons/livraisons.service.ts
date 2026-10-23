import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    HttpException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, StatutLivraison, UserRole, type User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
    EwuangClient,
    type CreerMissionEntree,
    type MissionCreee,
} from '../ewuang/ewuang.client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { calculerDevis } from '../tarifs/grille-tarifs.js';
import { CreerLivraisonDto } from './creer-livraison.dto.js';
import { ListerLivraisonsDto } from './lister-livraisons.dto.js';

/**
 * Courses soumises par les boutiques et dispatchées à Ewuang.
 *
 * ── Enregistrer d'abord, transmettre ensuite ───────────────────────────────
 *
 * La course est écrite en base AVANT l'appel à Ewuang, avec sa
 * `referenceExterne` et le corps exact envoyé (`chargeEwuang`). Si l'appel
 * échoue sur un timeout, on ne sait pas si Ewuang a créé la mission : la course
 * reste là, « non transmise », et se rejoue avec le même corps — Ewuang est
 * idempotent sur `reference_externe`, donc le rejeu ne crée pas de doublon.
 * L'ordre inverse perdrait la trace d'une mission peut-être créée chez lui.
 *
 * ── Ce que la boutique ne voit pas ─────────────────────────────────────────
 *
 * `commission`, `tarifEwuang` et `remunerationLivreur` sont la marge de
 * find_delivery et ce qu'elle paie à Ewuang : réservés à l'ADMIN.
 */

type Utilisateur = Pick<User, 'id' | 'role'>;

/** Issue d'une tentative de transmission à Ewuang. */
type Transmission =
    | { issue: 'transmise' }
    /** Échec rejouable : réseau, 5xx, clé refusée, plafond de débit. */
    | { issue: 'echec'; message: string }
    /** Refus définitif de la requête : la course est passée ANNULEE. */
    | { issue: 'refusee'; message: string };

const CHAMPS_BOUTIQUE = {
    id: true,
    referenceExterne: true,
    missionEwuangId: true,
    statut: true,
    statutEwuang: true,
    erreurEwuang: true,
    codeRemise: true,
    typeCourse: true,
    zoneDepart: true,
    zoneArrivee: true,
    adresseDepart: true,
    adresseArrivee: true,
    destinataireNom: true,
    destinataireContact: true,
    tarif: true,
    livreurNom: true,
    livreurContact: true,
    livreurTypeVehicule: true,
    noteLivreur: true,
    dateDemande: true,
    dateAcceptation: true,
    dateRecuperation: true,
    dateLivraison: true,
    dateAnnulation: true,
} satisfies Prisma.LivraisonSelect;

const CHAMPS_ADMIN = {
    ...CHAMPS_BOUTIQUE,
    boutiqueId: true,
    commission: true,
    tarifEwuang: true,
    remunerationLivreur: true,
} satisfies Prisma.LivraisonSelect;

@Injectable()
export class LivraisonsService {
    private readonly logger = new Logger(LivraisonsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly ewuang: EwuangClient,
    ) { }

    /**
     * Crée la course et la transmet à Ewuang.
     *
     * `transmise: false` : la course est enregistrée mais Ewuang n'a pas pu
     * être joint — le contrôleur répond alors 202.
     */
    async creer(user: Utilisateur, dto: CreerLivraisonDto) {
        const boutique = await this.prisma.boutique.findUnique({
            where: { userBoutiqueId: user.id },
        });
        if (!boutique) {
            throw new ForbiddenException(
                'Renseignez votre profil boutique (PUT /boutiques/moi) avant de soumettre une course',
            );
        }

        // `||` et non `??` : un champ de profil vide ("") n'est pas une
        // adresse.
        const adresseEnlevement = dto.enlevement?.adresse || boutique.address;
        const contactEnlevement =
            dto.enlevement?.contact || boutique.phoneAirtel || boutique.phoneMoov;
        if (!adresseEnlevement) {
            throw new BadRequestException(
                "Indiquez l'adresse d'enlèvement : votre profil boutique n'en a pas",
            );
        }
        if (!contactEnlevement) {
            throw new BadRequestException(
                "Indiquez le contact d'enlèvement : votre profil boutique n'a pas de téléphone",
            );
        }

        const devis = calculerDevis(dto.zone_depart, dto.zone_arrivee, dto.type_course);
        const referenceExterne = `FD-${randomUUID()}`;

        // Objets littéraux, pas les instances de DTO : ce corps est stocké en
        // JSON et rejoué tel quel.
        const charge: CreerMissionEntree = {
            reference_externe: referenceExterne,
            type_course: dto.type_course,
            // Une seule zone dans le contrat Ewuang, et c'est chez lui la ville
            // de destination.
            zone: dto.zone_arrivee,
            enlevement: {
                adresse: adresseEnlevement,
                contact: contactEnlevement,
                ...(dto.enlevement?.instructions
                    ? { instructions: dto.enlevement.instructions }
                    : {}),
            },
            destinataire: {
                nom: dto.destinataire.nom,
                adresse: dto.destinataire.adresse,
                contact: dto.destinataire.contact,
            },
            colis: {
                description: dto.colis.description,
                ...(dto.colis.vehicule_requis
                    ? { vehicule_requis: dto.colis.vehicule_requis }
                    : {}),
            },
            ...(dto.date_souhaitee ? { date_souhaitee: dto.date_souhaitee } : {}),
        };

        const livraison = await this.prisma.livraison.create({
            data: {
                boutiqueId: boutique.id,
                referenceExterne,
                typeCourse: dto.type_course,
                zoneDepart: dto.zone_depart,
                zoneArrivee: dto.zone_arrivee,
                adresseDepart: adresseEnlevement,
                adresseArrivee: dto.destinataire.adresse,
                destinataireNom: dto.destinataire.nom,
                destinataireContact: dto.destinataire.contact,
                tarif: devis.tarif,
                // Provisoire : la commission réelle se lit sur la part renvoyée
                // par Ewuang, et remplace celle-ci à la transmission.
                commission: devis.commission,
                chargeEwuang: charge as unknown as Prisma.InputJsonValue,
            },
            select: { id: true },
        });

        const transmission = await this.transmettre(livraison.id, devis.tarif, charge);
        return this.conclure(user, livraison.id, transmission);
    }

    /** Rejoue la transmission d'une course restée « non transmise ». */
    async renvoyer(user: Utilisateur, id: string) {
        const livraison = await this.trouverPourEcriture(user, id);

        if (livraison.missionEwuangId) {
            throw new ConflictException('Cette course a déjà été transmise à Ewuang');
        }
        if (livraison.statut === StatutLivraison.ANNULEE) {
            throw new ConflictException('Cette course est annulée');
        }
        if (!livraison.chargeEwuang) {
            throw new ConflictException(
                "Cette course n'a pas de demande enregistrée et ne peut pas être renvoyée",
            );
        }

        const transmission = await this.transmettre(
            livraison.id,
            livraison.tarif ?? 0,
            livraison.chargeEwuang as unknown as CreerMissionEntree,
        );
        return this.conclure(user, livraison.id, transmission);
    }

    /**
     * Annule la course, chez Ewuang d'abord.
     *
     * Ewuang refuse (409, relayé en 400) une fois le colis récupéré : le
     * livreur en répond, l'annulation passe alors par le support.
     */
    async annuler(user: Utilisateur, id: string) {
        const livraison = await this.trouverPourEcriture(user, id);

        if (
            livraison.statut === StatutLivraison.ANNULEE ||
            livraison.statutEwuang === 'Annulée'
        ) {
            throw new ConflictException('Cette course est déjà annulée');
        }
        if (livraison.statutEwuang === 'Livrée') {
            throw new ConflictException('Cette course est déjà livrée');
        }

        let missionEwuangId = livraison.missionEwuangId;

        // Course « non transmise » : l'appel a peut-être abouti chez Ewuang
        // malgré l'échec vu d'ici (timeout après création). L'annuler
        // seulement en local laisserait une mission vivante dans sa flotte.
        // Le contrat ne permet pas de chercher une mission par référence :
        // on rejoue la création, idempotente, pour récupérer son identifiant.
        if (!missionEwuangId && livraison.chargeEwuang) {
            const transmission = await this.transmettre(
                livraison.id,
                livraison.tarif ?? 0,
                livraison.chargeEwuang as unknown as CreerMissionEntree,
            );
            if (transmission.issue === 'refusee') {
                // Ewuang n'a pas de mission : `transmettre` a déjà annulé.
                return this.lire(user, livraison.id);
            }
            if (transmission.issue === 'echec') {
                throw new ServiceUnavailableException(
                    "Ewuang est injoignable : impossible de garantir l'annulation. Réessayez dans un instant.",
                );
            }
            const relue = await this.prisma.livraison.findUniqueOrThrow({
                where: { id: livraison.id },
                select: { missionEwuangId: true },
            });
            missionEwuangId = relue.missionEwuangId;
        }

        let statutEwuang: string | undefined;
        if (missionEwuangId) {
            const reponse = await this.ewuang.annulerMission(missionEwuangId);
            statutEwuang = typeof reponse.statut === 'string' ? reponse.statut : 'Annulée';
        }

        await this.prisma.livraison.update({
            where: { id: livraison.id },
            data: {
                statut: StatutLivraison.ANNULEE,
                dateAnnulation: new Date(),
                ...(statutEwuang ? { statutEwuang } : {}),
            },
        });

        return this.lire(user, livraison.id);
    }

    async lister(user: Utilisateur, { page, limite }: ListerLivraisonsDto) {
        const where = this.portee(user);
        const [donnees, total] = await this.prisma.$transaction([
            this.prisma.livraison.findMany({
                where,
                select: this.champs(user),
                orderBy: { dateDemande: 'desc' },
                skip: (page - 1) * limite,
                take: limite,
            }),
            this.prisma.livraison.count({ where }),
        ]);
        return { donnees, total, page, limite };
    }

    /** Détail d'une course, avec la demande telle qu'envoyée à Ewuang. */
    async lire(user: Utilisateur, id: string) {
        const livraison = await this.prisma.livraison.findFirst({
            where: { ...this.portee(user), id },
            select: { ...this.champs(user), chargeEwuang: true },
        });
        // 404 et non 403 pour la course d'une autre boutique : l'existence
        // d'un identifiant ne doit pas fuiter.
        if (!livraison) {
            throw new NotFoundException('Course introuvable');
        }
        return livraison;
    }

    /**
     * Appelle `POST /partenaires/missions` et range le résultat.
     *
     * Ne lève pas pour un échec d'Ewuang : l'issue est rendue à l'appelant,
     * qui seul sait quoi en faire (202, 400, ou poursuivre une annulation).
     */
    private async transmettre(
        id: string,
        tarif: number,
        charge: CreerMissionEntree,
    ): Promise<Transmission> {
        let mission: MissionCreee;
        try {
            mission = await this.ewuang.creerMission(charge);
        } catch (erreur) {
            if (!(erreur instanceof HttpException)) throw erreur;

            const message = erreur.message;
            if (erreur instanceof BadRequestException) {
                await this.prisma.livraison.update({
                    where: { id },
                    data: {
                        statut: StatutLivraison.ANNULEE,
                        dateAnnulation: new Date(),
                        erreurEwuang: message,
                    },
                });
                this.logger.warn(`Course ${id} refusée par Ewuang : ${message}`);
                return { issue: 'refusee', message };
            }

            await this.prisma.livraison.update({
                where: { id },
                data: { erreurEwuang: message },
            });
            return { issue: 'echec', message };
        }

        await this.prisma.$transaction([
            this.prisma.livraison.update({
                where: { id },
                data: {
                    missionEwuangId: mission.mission_id,
                    codeRemise: mission.code_remise,
                    // La part d'Ewuang est `remuneration_livreur`, PAS
                    // `tarif` : dans sa grille `partenaire_tarifs`, `tarif`
                    // est le prix de la zone (Akanda standard 1 500) et
                    // `remuneration_livreur` ce qu'il garde après nous avoir
                    // reversé 5 % (1 425). Prendre `tarif` donnerait une
                    // commission nulle sur toute course intra-zone. Cette
                    // part fait foi sur celle de notre grille (voir
                    // grille-tarifs.ts : la grille sert à deviser).
                    tarifEwuang: mission.remuneration_livreur,
                    remunerationLivreur: mission.remuneration_livreur,
                    commission: tarif - mission.remuneration_livreur,
                    erreurEwuang: null,
                },
            }),
            // Le statut n'est posé que si aucun webhook ne l'a fait avant :
            // un `mission.attribuee` peut nous atteindre avant que cette
            // réponse ne soit traitée, et « En attente » l'écraserait.
            this.prisma.livraison.updateMany({
                where: { id, statutEwuang: null },
                data: { statutEwuang: mission.statut },
            }),
        ]);
        return { issue: 'transmise' };
    }

    /** Traduit l'issue d'une transmission en réponse HTTP. */
    private async conclure(user: Utilisateur, id: string, transmission: Transmission) {
        if (transmission.issue === 'refusee') {
            throw new BadRequestException(
                `Ewuang a refusé la course : ${transmission.message}`,
            );
        }
        return {
            transmise: transmission.issue === 'transmise',
            livraison: await this.lire(user, id),
        };
    }

    private async trouverPourEcriture(user: Utilisateur, id: string) {
        const livraison = await this.prisma.livraison.findFirst({
            where: { ...this.portee(user), id },
            select: {
                id: true,
                tarif: true,
                statut: true,
                statutEwuang: true,
                missionEwuangId: true,
                chargeEwuang: true,
            },
        });
        if (!livraison) {
            throw new NotFoundException('Course introuvable');
        }
        return livraison;
    }

    /** Une boutique ne voit que ses courses ; l'ADMIN les voit toutes. */
    private portee(user: Utilisateur): Prisma.LivraisonWhereInput {
        return user.role === UserRole.ADMIN
            ? {}
            : { boutique: { userBoutiqueId: user.id } };
    }

    private champs(user: Utilisateur) {
        return user.role === UserRole.ADMIN ? CHAMPS_ADMIN : CHAMPS_BOUTIQUE;
    }
}
