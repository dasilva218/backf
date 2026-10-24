import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Flotte, Prisma, TypeMouvementEspeces, type Payeur } from '@prisma/client';
import { EspecesService, type EcritureCourse } from '../especes/especes.service.js';
import { FORFAIT_RETOUR } from '../livraisons/encaissement.js';

/**
 * Application des événements reçus d'Ewuang sur les courses locales.
 *
 * Trois règles tiennent ce fichier, et chacune répare une panne précise :
 *
 *  1. **Dédoublonnage sur `evenementId`.** Ewuang livre au moins une fois ; les
 *     doublons sont certains. Sans unicité, un changement de statut s'applique
 *     deux fois.
 *  2. **Ordre par `emis_at`, pas par arrivée.** L'ordre de livraison n'est pas
 *     garanti : un `mission.attribuee` relancé peut arriver après un
 *     `mission.livree`. Sans cette borne, la course repart en arrière.
 *  3. **Jamais d'écriture locale du statut.** Le statut vient d'Ewuang et de lui
 *     seul. Un écran qui le modifierait ici créerait une divergence que rien ne
 *     signalerait — c'est pour ça que `statutEwuang` existe à côté de `statut`.
 *  4. **Le verrou de flotte** (livreur-courses.service.ts). `mission.attribuee`
 *     pose `flotte = EWUANG` seulement si personne n'a pris la course ;
 *     `mission.rendue` la remet au pot commun. Une course prise par la flotte
 *     find_delivery n'écoute plus Ewuang : son annulation chez lui, que nous
 *     avons demandée, ne doit pas l'annuler chez nous.
 */

/** Ewuang n'écrit que sur une course libre ou déjà à lui. */
const PAS_A_FIND_DELIVERY = {
    OR: [{ flotte: null }, { flotte: Flotte.EWUANG }],
} satisfies Prisma.LivraisonWhereInput;

/** Le statut qui résulte de chaque type d'événement, d'après le contrat §7. */
const STATUT_PAR_TYPE: Record<string, string> = {
    'mission.attribuee': 'En cours de livraison',
    'mission.colis_recupere': 'Colis récupéré',
    'mission.livree': 'Livrée',
    'mission.rendue': 'En attente',
    'mission.reportee': 'Reportée',
    'mission.annulee': 'Annulée',
    // v2 du contrat, §3.
    'mission.echec_remise': 'Retour expéditeur',
    'mission.retournee': 'Retournée',
};

/**
 * Montant encaissé par le livreur Ewuang à cette étape (v2, §2), si
 * l'événement en porte un lisible. Un champ malformé est ignoré plutôt que de
 * faire échouer l'événement entier.
 */
function lireEncaissement(evenement: EvenementEwuang, repli: Date): { montant: number; at: Date } | null {
    const montant = evenement.encaissement?.montant;
    if (typeof montant !== 'number' || !Number.isInteger(montant) || montant <= 0) return null;
    const at = new Date(texteOuUndefined(evenement.encaissement?.encaisse_at) ?? '');
    return { montant, at: Number.isNaN(at.getTime()) ? repli : at };
}

/** La valeur si c'est une chaîne non vide, sinon `undefined`. */
function texteOuUndefined(valeur: unknown): string | undefined {
    return typeof valeur === 'string' && valeur.length > 0 ? valeur : undefined;
}

/** Ce qu'il faut d'une course pour écrire au registre ce qu'Ewuang y a fait. */
export interface CoursePourRegistre {
    id: string;
    clientId: string | null;
    payeur: Payeur | null;
    montantMarchandise: number;
    tarifEwuang: number | null;
}

/**
 * Écritures au registre des espèces pour un événement Ewuang (contrat v2).
 *
 * Seulement sur une course payée en espèces (`payeur` non null) : les courses
 * d'avant le 2026-10-23 se règlent hors course. Compte Ewuang : + ce que son
 * livreur a encaissé, − ce que la course lui coûte (à la fin : livrée, ou
 * retournée avec le forfait). Compte client : la marchandise, à la remise.
 */
export function ecrituresEwuang(
    evenement: EvenementEwuang,
    course: CoursePourRegistre,
    emisAt: Date,
): EcritureCourse[] {
    if (!course.payeur) return [];
    const encaisse = lireEncaissement(evenement, emisAt)?.montant ?? 0;
    const encaissement = (etape: 'ewuang:enlevement' | 'ewuang:remise' | 'ewuang:retour'): EcritureCourse => ({
        type: TypeMouvementEspeces.ENCAISSEMENT_EWUANG,
        livraisonId: course.id,
        etape,
        montant: encaisse,
    });
    const tarif = (montant: number): EcritureCourse => ({
        type: TypeMouvementEspeces.TARIF_EWUANG,
        livraisonId: course.id,
        etape: 'ewuang:tarif',
        montant,
    });

    switch (evenement.type) {
        case 'mission.colis_recupere':
            return [encaissement('ewuang:enlevement')];
        case 'mission.livree':
            return [
                encaissement('ewuang:remise'),
                tarif(course.tarifEwuang ?? 0),
                ...(course.montantMarchandise > 0 && course.clientId
                    ? [{
                        type: TypeMouvementEspeces.MARCHANDISE,
                        livraisonId: course.id,
                        etape: 'marchandise' as const,
                        montant: course.montantMarchandise,
                        clientId: course.clientId,
                    }]
                    : []),
            ];
        case 'mission.retournee':
            // Le forfait retour est celui de notre grille (R3), égal à celui
            // figé chez Ewuang pour find_delivery (`partenaires.forfait_retour`).
            return [encaissement('ewuang:retour'), tarif((course.tarifEwuang ?? 0) + FORFAIT_RETOUR)];
        default:
            return [];
    }
}

export interface EvenementEwuang {
    evenement_id: string;
    type: string;
    emis_at: string;
    mission_id: string;
    reference_externe?: string;
    statut?: string;
    motif?: string;
    livree_at?: string;
    date_livraison?: string;
    livreur?: {
        id?: string;
        nom?: string;
        contact?: string;
        type_vehicule?: string;
    };
    /** v2 : espèces reçues à cette étape. */
    encaissement?: { montant?: unknown; encaisse_at?: unknown };
}

@Injectable()
export class EwuangWebhookService {
    private readonly logger = new Logger(EwuangWebhookService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly especes: EspecesService,
    ) { }

    /**
     * Enregistre l'événement puis l'applique.
     *
     * L'enregistrement d'abord, l'application ensuite : si l'application échoue,
     * la charge utile reste en base et l'événement est rejouable à la main.
     * Ewuang, lui, ne le renverra pas — pour lui il a été acquitté.
     *
     * Ne lève jamais. L'appelant a déjà répondu 2xx : lever ici ne ferait
     * qu'empiler une exception non capturée. Les refus sont tracés dans
     * `ignoreMotif`.
     */
    async traiter(evenement: EvenementEwuang): Promise<void> {
        const emisAt = new Date(evenement.emis_at);

        // Un `emis_at` illisible rendrait la règle d'ordre inopérante : on
        // conserve l'événement sans l'appliquer plutôt que de le dater à
        // maintenant, ce qui le ferait passer pour le plus récent.
        if (Number.isNaN(emisAt.getTime())) {
            await this.journaliser(evenement, new Date(0), 'emis_at illisible');
            this.logger.warn(
                `Événement ${evenement.evenement_id} ignoré : emis_at illisible (${evenement.emis_at})`,
            );
            return;
        }

        // Dédoublonnage. `create` plutôt qu'un `findUnique` suivi d'un
        // `create` : entre les deux, une relance concurrente d'Ewuang se
        // glisserait et l'événement passerait deux fois. C'est la contrainte
        // d'unicité qui tranche, pas une lecture préalable.
        try {
            await this.prisma.evenementEwuangRecu.create({
                data: {
                    evenementId: evenement.evenement_id,
                    type: evenement.type,
                    missionEwuangId: evenement.mission_id ?? null,
                    emisAt,
                    charge: evenement as unknown as Prisma.InputJsonValue,
                },
            });
        } catch (erreur) {
            if (
                erreur instanceof Prisma.PrismaClientKnownRequestError &&
                erreur.code === 'P2002'
            ) {
                this.logger.log(
                    `Événement ${evenement.evenement_id} déjà reçu — relance d'Ewuang, rien à faire`,
                );
                return;
            }
            this.logger.error(
                `Impossible de journaliser l'événement ${evenement.evenement_id}: ${(erreur as Error).message}`,
            );
            return;
        }

        await this.appliquer(evenement, emisAt);
    }

    /** Trace un événement reçu mais délibérément non appliqué. */
    private async journaliser(
        evenement: EvenementEwuang,
        emisAt: Date,
        motif: string,
    ): Promise<void> {
        try {
            await this.prisma.evenementEwuangRecu.create({
                data: {
                    evenementId: evenement.evenement_id,
                    type: evenement.type,
                    missionEwuangId: evenement.mission_id ?? null,
                    emisAt,
                    charge: evenement as unknown as Prisma.InputJsonValue,
                    ignoreMotif: motif,
                },
            });
        } catch {
            // Doublon, ou base indisponible. Le log de l'appelant suffit.
        }
    }

    private async appliquer(
        evenement: EvenementEwuang,
        emisAt: Date,
    ): Promise<void> {
        const course = await this.prisma.livraison.findFirst({
            where: {
                OR: [
                    { missionEwuangId: evenement.mission_id },
                    ...(evenement.reference_externe
                        ? [{ referenceExterne: evenement.reference_externe }]
                        : []),
                ],
            },
            select: {
                id: true,
                dernierEvenementAt: true,
                flotte: true,
                clientId: true,
                payeur: true,
                montantMarchandise: true,
                tarifEwuang: true,
            },
        });

        // Mission inconnue : l'événement reste en base. Cela arrive
        // légitimement — une mission créée par un autre environnement pointant
        // sur la même URL de webhook — et il vaut mieux une ligne à inspecter
        // qu'un 404 qui ferait relancer Ewuang jusqu'à épuisement.
        if (!course) {
            await this.marquerIgnore(
                evenement.evenement_id,
                'Mission inconnue dans cette base',
            );
            this.logger.warn(
                `Événement ${evenement.evenement_id} : mission ${evenement.mission_id} inconnue`,
            );
            return;
        }

        if (course.flotte === Flotte.FIND_DELIVERY) {
            await this.marquerIgnore(evenement.evenement_id, 'Course prise par la flotte find_delivery');
            return;
        }

        // Règle d'ordre. `>=` et non `>` : deux événements au même instant sont
        // le même fait relancé, et le second n'apporte rien.
        if (
            course.dernierEvenementAt &&
            course.dernierEvenementAt.getTime() >= emisAt.getTime()
        ) {
            await this.marquerIgnore(
                evenement.evenement_id,
                `Plus ancien que le dernier appliqué (${course.dernierEvenementAt.toISOString()})`,
            );
            return;
        }

        // Le statut du contrat fait foi sur celui déduit du type : c'est Ewuang
        // qui le calcule, et le tableau local n'est qu'un repli pour un type
        // qui arriverait sans statut.
        const statut =
            texteOuUndefined(evenement.statut) ?? STATUT_PAR_TYPE[evenement.type];
        if (!statut) {
            await this.marquerIgnore(
                evenement.evenement_id,
                `Type inconnu et sans statut : ${evenement.type}`,
            );
            this.logger.warn(
                `Événement ${evenement.evenement_id} : type « ${evenement.type} » inconnu`,
            );
            return;
        }

        const donnees: Prisma.LivraisonUpdateManyMutationInput = {
            statutEwuang: statut,
            dernierEvenementAt: emisAt,
            missionEwuangId: evenement.mission_id,
        };

        // L'instantané du livreur n'est posé que si l'événement le porte, et
        // n'est jamais effacé : `mission.rendue` et `mission.annulee` n'ont pas
        // de livreur, et remettre les champs à null ferait perdre qui détenait
        // le colis juste avant.
        // Chaque champ est contrôlé avant d'atteindre Prisma : un type inattendu
        // ferait échouer toute la mise à jour, et l'événement — déjà dédoublonné
        // — serait perdu sans qu'Ewuang le renvoie jamais.
        const livreurId = texteOuUndefined(evenement.livreur?.id);
        if (livreurId) {
            donnees.livreurEwuangId = livreurId;
            const nom = texteOuUndefined(evenement.livreur?.nom);
            const contact = texteOuUndefined(evenement.livreur?.contact);
            const vehicule = texteOuUndefined(evenement.livreur?.type_vehicule);
            if (nom) donnees.livreurNom = nom;
            if (contact) donnees.livreurContact = contact;
            if (vehicule) donnees.livreurTypeVehicule = vehicule;
        }

        // Jalons. `dateLivraison` vient de `livree_at` quand Ewuang le fournit :
        // c'est l'instant de la remise, pas celui où le webhook nous atteint,
        // qui peut suivre de plusieurs minutes après une relance.
        if (evenement.type === 'mission.attribuee') {
            donnees.dateAcceptation = emisAt;
            donnees.flotte = Flotte.EWUANG;
        } else if (evenement.type === 'mission.rendue') {
            // Le livreur Ewuang a rendu la course avant l'enlèvement : elle
            // redevient ouverte aux deux flottes.
            donnees.flotte = null;
            donnees.reserveeEwuangAt = null;
        } else if (evenement.type === 'mission.colis_recupere') {
            donnees.dateRecuperation = emisAt;
            const encaisse = lireEncaissement(evenement, emisAt);
            if (encaisse) {
                donnees.montantEncaisseEnlevement = encaisse.montant;
                donnees.encaisseEnlevementAt = encaisse.at;
            }
        } else if (evenement.type === 'mission.livree') {
            // Une date illisible retombe sur `emisAt` plutôt que de faire
            // échouer la mise à jour : la course resterait sinon « en cours »
            // alors que le colis est remis.
            const livreeAt = new Date(texteOuUndefined(evenement.livree_at) ?? '');
            donnees.dateLivraison = Number.isNaN(livreeAt.getTime()) ? emisAt : livreeAt;
            const encaisse = lireEncaissement(evenement, emisAt);
            if (encaisse) {
                donnees.montantEncaisseRemise = encaisse.montant;
                donnees.encaisseRemiseAt = encaisse.at;
            }
        } else if (evenement.type === 'mission.retournee') {
            donnees.dateRetour = emisAt;
            const encaisse = lireEncaissement(evenement, emisAt);
            if (encaisse) {
                donnees.montantEncaisseRetour = encaisse.montant;
                donnees.encaisseRetourAt = encaisse.at;
            }
        } else if (evenement.type === 'mission.annulee') {
            donnees.dateAnnulation = emisAt;
        }

        const motif = texteOuUndefined(evenement.motif);
        if (motif) {
            donnees.noteLivreur = motif;
        }

        try {
            await this.prisma.$transaction(async (tx) => {
                // La règle d'ordre est revérifiée DANS l'écriture : deux
                // événements traités en parallèle ont pu lire tous deux l'ancien
                // `dernierEvenementAt` plus haut, et le plus ancien écraserait
                // alors le plus récent.
                //
                // Le verrou de flotte l'est aussi : un livreur find_delivery a
                // pu prendre la course depuis la lecture.
                const { count } = await tx.livraison.updateMany({
                    where: {
                        id: course.id,
                        AND: [
                            {
                                OR: [
                                    { dernierEvenementAt: null },
                                    { dernierEvenementAt: { lt: emisAt } },
                                ],
                            },
                            PAS_A_FIND_DELIVERY,
                        ],
                    },
                    data: donnees,
                });
                // L'argent suit le statut, dans la même transaction : un
                // événement appliqué a ses écritures, un événement écarté n'en
                // a pas.
                if (count === 1) {
                    await this.especes.ecrireCourse(tx, ecrituresEwuang(evenement, course, emisAt));
                }
                await tx.evenementEwuangRecu.update({
                    where: { evenementId: evenement.evenement_id },
                    data:
                        count === 1
                            ? { traiteAt: new Date() }
                            : { ignoreMotif: 'Dépassé par un événement plus récent, ou course prise par la flotte find_delivery entre-temps' },
                });
            });
        } catch (erreur) {
            this.logger.error(
                `Application de l'événement ${evenement.evenement_id} échouée : ${(erreur as Error).message}`,
            );
        }
    }

    private async marquerIgnore(
        evenementId: string,
        motif: string,
    ): Promise<void> {
        try {
            await this.prisma.evenementEwuangRecu.update({
                where: { evenementId },
                data: { ignoreMotif: motif },
            });
        } catch {
            // L'événement vient d'être créé : un échec ici ne doit pas masquer
            // le motif, déjà journalisé par l'appelant.
        }
    }
}
