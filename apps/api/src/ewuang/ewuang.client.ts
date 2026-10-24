import {
    BadGatewayException,
    BadRequestException,
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Client de l'API partenaires d'Ewuang.
 *
 * Contrat : `ewuang-web/docs/contrat-api-partenaires.md`. Toute divergence
 * entre ce fichier et ce document est un bug de ce fichier.
 *
 * ── Deux choses à savoir avant d'y toucher ─────────────────────────────────
 *
 * L'authentification passe par l'en-tête `X-Ewuang-Cle`, PAS par
 * `Authorization: Bearer`. C'est délibéré côté Ewuang : `Authorization` y porte
 * déjà les jetons Supabase de ses propres utilisateurs, et un middleware qui
 * devrait distinguer un jeton d'une clé de partenaire sur le même en-tête
 * finirait par se tromper.
 *
 * La clé ne doit jamais être journalisée. Les messages d'erreur de ce fichier
 * reprennent le statut HTTP et le corps d'Ewuang, jamais les en-têtes.
 */

const TIMEOUT_MS = 10_000;

export type TypeCourse = 'standard' | 'express' | 'volumineux';
export type VehiculeRequis = 'moto' | 'voiture' | 'camionnette';

export interface CreerMissionEntree {
    reference_externe: string;
    type_course: TypeCourse;
    zone: string;
    enlevement: { adresse: string; contact: string; instructions?: string };
    destinataire: { nom: string; adresse: string; contact: string };
    colis: { description: string; vehicule_requis?: VehiculeRequis };
    date_souhaitee?: string;
    /**
     * Encaissement en espèces (v2 du contrat, §2). Ignoré par un Ewuang encore
     * en v1 : son schéma écarte les champs qu'il ne connaît pas.
     */
    paiement?: PaiementMission;
}

export interface PaiementMission {
    mode: 'especes';
    payeur: 'expediteur' | 'destinataire';
    /** Prix payé par NOTRE client, à encaisser auprès du payeur. */
    frais: number;
    /** Contre-remboursement, toujours payé par le destinataire à la remise. */
    montant_marchandise: number;
}

export interface MissionCreee {
    mission_id: string;
    reference_externe: string;
    statut: string;
    code_remise: string;
    tarif: number;
    remuneration_livreur: number;
    devise: string;
    disponible_at: string;
}

export interface LivreurFlotte {
    id: string;
    nom: string | null;
    contact: string | null;
    en_ligne: boolean;
    occupe: boolean;
    courses_en_cours: number;
    latitude: number | null;
    longitude: number | null;
    precision_m: number | null;
    position_at: string | null;
}

@Injectable()
export class EwuangClient {
    private readonly logger = new Logger(EwuangClient.name);

    constructor(private readonly config: ConfigService) { }

    private get baseUrl(): string {
        const url = this.config.get<string>('EWUANG_API_URL');
        if (!url) {
            throw new ServiceUnavailableException(
                "L'intégration Ewuang n'est pas configurée (EWUANG_API_URL)",
            );
        }
        return url.replace(/\/+$/, '');
    }

    private get cle(): string {
        const cle = this.config.get<string>('EWUANG_API_KEY');
        if (!cle) {
            throw new ServiceUnavailableException(
                "L'intégration Ewuang n'est pas configurée (EWUANG_API_KEY)",
            );
        }
        return cle;
    }

    /**
     * Appel HTTP unique, pour que le timeout, les en-têtes et la lecture des
     * erreurs n'existent qu'à un seul endroit.
     *
     * Le timeout est explicite : `fetch` sans `AbortSignal` attend
     * indéfiniment, et une requête de création de mission bloquée tiendrait la
     * requête HTTP du vendeur pour toujours.
     */
    private async appeler<T>(
        chemin: string,
        init: { method: string; body?: unknown } = { method: 'GET' },
    ): Promise<T> {
        const url = `${this.baseUrl}${chemin}`;

        let reponse: Response;
        try {
            reponse = await fetch(url, {
                method: init.method,
                headers: {
                    'X-Ewuang-Cle': this.cle,
                    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
                },
                body: init.body ? JSON.stringify(init.body) : undefined,
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
        } catch (erreur) {
            // Réseau, DNS, timeout. On ne sait PAS si Ewuang a traité la
            // requête : sur un POST de mission, c'est exactement le cas que
            // `reference_externe` rend rejouable sans doublon.
            this.logger.error(
                `Ewuang injoignable sur ${init.method} ${chemin}: ${(erreur as Error).message}`,
            );
            throw new ServiceUnavailableException(
                'Ewuang est momentanément injoignable. La course est enregistrée et sera renvoyée.',
            );
        }

        const texte = await reponse.text();
        const corps = texte ? safeJson(texte) : null;

        if (!reponse.ok) {
            // Seul le champ `error` d'un corps JSON d'Ewuang est relayé à la
            // boutique (ses messages de validation, en français, lui sont
            // utiles). Une page HTML de proxy ou un corps inattendu reste dans
            // le journal et n'atteint jamais l'écran.
            const erreurEwuang = (corps as { error?: unknown } | null)?.error;
            const message =
                typeof erreurEwuang === 'string' && erreurEwuang.length <= 300
                    ? erreurEwuang
                    : `Ewuang a répondu ${reponse.status}`;

            this.logger.warn(
                `Ewuang ${reponse.status} sur ${init.method} ${chemin}: ${texte.slice(0, 500)}`,
            );

            // 401/403 = notre clé ou ses scopes, 429 = notre rythme : la
            // requête n'est pas en cause, elle passera une fois la
            // configuration corrigée ou le plafond retombé. Les classer en 400
            // ferait passer une clé révoquée pour un refus de chaque course.
            if (reponse.status === 401 || reponse.status === 403) {
                this.logger.error(
                    `Ewuang refuse notre clé (${reponse.status}) : vérifier EWUANG_API_KEY et ses scopes`,
                );
                throw new ServiceUnavailableException(
                    "L'accès à Ewuang est momentanément refusé. La course est enregistrée et sera renvoyée.",
                );
            }
            // 408 (délai côté Ewuang) et 425 (trop tôt) disent « réessayez » :
            // les traiter comme un refus annulerait définitivement la course.
            if (reponse.status === 429 || reponse.status === 408 || reponse.status === 425) {
                throw new ServiceUnavailableException(
                    'Ewuang limite momentanément les appels. La course est enregistrée et sera renvoyée.',
                );
            }

            // Autre 4xx = notre requête est en cause et la rejouer telle
            // quelle donnera le même refus ; 5xx = la leur, et elle se rejoue.
            if (reponse.status >= 400 && reponse.status < 500) {
                throw new BadRequestException(message);
            }
            throw new BadGatewayException(message);
        }

        return corps as T;
    }

    /**
     * `POST /partenaires/missions` — dispatche une course à la flotte Ewuang.
     *
     * Idempotent sur `reference_externe` : le même appel rejoué rend la même
     * mission, avec le même `mission_id` et le même `code_remise`. C'est ce qui
     * permet de relancer sans crainte après un timeout. En revanche un MÊME
     * `reference_externe` avec un corps DIFFÉRENT est refusé (409) — ce n'est
     * pas une relance, c'est une autre course sous un identifiant déjà pris.
     */
    creerMission(entree: CreerMissionEntree): Promise<MissionCreee> {
        return this.appeler<MissionCreee>('/partenaires/missions', {
            method: 'POST',
            body: entree,
        });
    }

    /** `GET /partenaires/missions/{id}` — état d'une mission. */
    lireMission(missionId: string): Promise<Record<string, unknown>> {
        return this.appeler(`/partenaires/missions/${missionId}`);
    }

    /**
     * `DELETE /partenaires/missions/{id}` — annule une mission.
     *
     * Possible jusqu'à « Colis récupéré » exclus : une fois le colis entre les
     * mains du livreur, Ewuang refuse (le livreur en répond).
     */
    annulerMission(missionId: string): Promise<Record<string, unknown>> {
        return this.appeler(`/partenaires/missions/${missionId}`, {
            method: 'DELETE',
        });
    }

    /**
     * `GET /partenaires/flotte` — position des livreurs.
     *
     * À interroger en polling à 15 s, pas plus serré : au-delà le plafond de
     * débit d'Ewuang répond 429. Il n'y a pas de flux temps réel.
     *
     * Deux pièges du contrat, à ne pas « corriger » ici :
     *   • seuls les livreurs ayant accepté les courses partenaires figurent
     *     dans la réponse, et ce choix est révocable par chacun d'eux à tout
     *     moment. Une flotte qui se réduit d'un appel à l'autre n'est donc pas
     *     une panne ;
     *   • `position_at` peut être ancien. C'est à NOUS de périmer une position
     *     au-delà de cinq minutes : une position périmée affichée comme
     *     actuelle est pire qu'une absence.
     */
    lireFlotte(): Promise<{ livreurs: LivreurFlotte[]; genere_at: string }> {
        return this.appeler('/partenaires/flotte');
    }

    /**
     * `GET /partenaires/livreurs/{id}` — fiche d'un livreur.
     *
     * Rend 404 aussi bien pour un identifiant inconnu que pour un livreur qui
     * refuse les courses partenaires : Ewuang ne les distingue pas, pour qu'on
     * ne puisse pas sonder sa base. Ne pas traiter un 404 comme une anomalie.
     */
    lireLivreur(livreurId: string): Promise<Record<string, unknown>> {
        return this.appeler(`/partenaires/livreurs/${livreurId}`);
    }
}

/**
 * Un corps non-JSON ne doit pas masquer le statut HTTP qui l'accompagne. Il
 * n'est pas recopié dans `error` : il finirait affiché à la boutique.
 */
function safeJson(texte: string): unknown {
    try {
        return JSON.parse(texte);
    } catch {
        return null;
    }
}
