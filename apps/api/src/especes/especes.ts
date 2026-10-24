import { TypeMouvementEspeces } from '@prisma/client';

/**
 * Les règles du registre des espèces, en fonctions pures.
 *
 * Constantes en code au lancement, pas en table de paramètres : changer un
 * plafond reste un déploiement, tant qu'aucun écran ADMIN ne les édite.
 */

/** R5 : au-delà, le livreur ne prend plus de nouvelle course avant d'avoir versé. */
export const PLAFOND_ENCOURS = 50_000;

/** R5 : délai pour verser les espèces encaissées. */
export const DELAI_VERSEMENT_MS = 48 * 3_600_000;

const T = TypeMouvementEspeces;

/**
 * Effet de chaque type sur le solde de son compte.
 *
 * Livreur : + ce qu'il détient pour find_delivery, − ce qu'il peut garder ou a
 * déjà versé. Client : + ce que find_delivery lui doit, − ce qui lui a été
 * reversé. Ewuang : + ce qu'il nous doit (ses livreurs ont encaissé), − ce
 * que nos courses lui coûtent et ce qu'il nous a réglé.
 */
const SENS: Record<TypeMouvementEspeces, 1 | -1> = {
    [T.ENCAISSEMENT]: 1,
    [T.PAIEMENT_LIVREUR]: 1,
    [T.REMUNERATION]: -1,
    [T.VERSEMENT]: -1,
    [T.MARCHANDISE]: 1,
    [T.REVERSEMENT]: -1,
    [T.ENCAISSEMENT_EWUANG]: 1,
    [T.REGLEMENT_EWUANG_VERSE]: 1,
    [T.TARIF_EWUANG]: -1,
    [T.REGLEMENT_EWUANG_RECU]: -1,
};

export const TYPES_LIVREUR: TypeMouvementEspeces[] = [T.ENCAISSEMENT, T.REMUNERATION, T.VERSEMENT, T.PAIEMENT_LIVREUR];
export const TYPES_CLIENT: TypeMouvementEspeces[] = [T.MARCHANDISE, T.REVERSEMENT];
export const TYPES_EWUANG: TypeMouvementEspeces[] = [
    T.ENCAISSEMENT_EWUANG,
    T.TARIF_EWUANG,
    T.REGLEMENT_EWUANG_RECU,
    T.REGLEMENT_EWUANG_VERSE,
];

export function sens(type: TypeMouvementEspeces): 1 | -1 {
    return SENS[type];
}

/** Solde d'un compte à partir des sommes par type (un `groupBy`). */
export function solde(sommes: { type: TypeMouvementEspeces; montant: number }[]): number {
    return sommes.reduce((total, s) => total + SENS[s.type] * s.montant, 0);
}

export interface EtatLivreur {
    /** > 0 : à verser à find_delivery. < 0 : find_delivery lui doit. */
    solde: number;
    plafond: number;
    /** Encaissement le plus ancien pas encore couvert par un versement. */
    depuis: Date | null;
    /** Date limite du versement (R5) ; null quand rien n'est dû. */
    echeance: Date | null;
    /** Pourquoi il ne peut plus prendre de course ; null sinon. */
    blocage: string | null;
}

/**
 * R5, appliquée sans état : le blocage se lève de lui-même dès que le versement
 * est saisi. Il porte sur les NOUVELLES courses seulement ; celles en main
 * continuent, un colis ne reste pas en route.
 */
export function etatLivreur(soldeLivreur: number, depuis: Date | null, maintenant: Date): EtatLivreur {
    const echeance = soldeLivreur > 0 && depuis ? new Date(depuis.getTime() + DELAI_VERSEMENT_MS) : null;
    let blocage: string | null = null;
    if (soldeLivreur >= PLAFOND_ENCOURS) {
        blocage = `Vous détenez ${fcfa(soldeLivreur)} : au-delà de ${fcfa(PLAFOND_ENCOURS)}, versez-les à find_delivery avant de prendre une nouvelle course.`;
    } else if (echeance && echeance.getTime() <= maintenant.getTime()) {
        blocage = `Versement en retard : ${fcfa(soldeLivreur)} sont à verser à find_delivery depuis plus de 48 h. Versez-les pour reprendre des courses.`;
    }
    return { solde: soldeLivreur, plafond: PLAFOND_ENCOURS, depuis: echeance ? depuis : null, echeance, blocage };
}

function fcfa(montant: number): string {
    return `${montant.toLocaleString('fr-FR')} FCFA`;
}
