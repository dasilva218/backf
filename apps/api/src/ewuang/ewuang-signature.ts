import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Vérification de la signature des webhooks Ewuang.
 *
 * Contrat : `X-Ewuang-Signature: t=<epoch secondes>,v1=<hex>`, où `v1` est un
 * HMAC-SHA256 en hexadécimal minuscule de la chaîne `"<t>.<corps brut>"`, avec
 * le secret du webhook comme clé.
 *
 * ── Pourquoi le corps BRUT, et pourquoi ce fichier ne parse rien ───────────
 *
 * Re-sérialiser le JSON change les octets — ordre des clés, espaces, échappement
 * des accents — et la signature ne correspond plus. Le piège est méchant parce
 * qu'il est silencieux au développement : avec un corps simple, `JSON.stringify`
 * rend parfois exactement les mêmes octets, et la vérification passe. Elle
 * cassera en production sur le premier accent, c'est-à-dire sur le premier
 * « Colis récupéré ».
 *
 * D'où la règle tenue ici : cette fonction prend un `Buffer`, jamais un objet.
 * C'est au bootstrap d'activer `rawBody` (voir `main.ts`).
 */

/** Fenêtre d'acceptation de l'horodatage. Au-delà, l'événement est un rejeu. */
export const FENETRE_SIGNATURE_SECONDES = 5 * 60;

export type ResultatVerification =
    | { valide: true }
    | { valide: false; motif: string };

/**
 * Découpe `t=...,v1=...` sans présumer de l'ordre des paires ni de l'absence
 * d'espaces. Une signature mal formée doit être refusée explicitement, pas
 * produire un `undefined` qui se compare ensuite à n'importe quoi.
 */
function lireEntete(entete: string): { t: string; v1: string } | null {
    let t: string | undefined;
    let v1: string | undefined;

    for (const partie of entete.split(',')) {
        const [cle, valeur] = partie.trim().split('=');
        if (cle === 't') t = valeur;
        if (cle === 'v1') v1 = valeur;
    }

    if (!t || !v1) return null;
    if (!/^\d+$/.test(t)) return null;
    if (!/^[0-9a-f]+$/.test(v1)) return null;

    return { t, v1 };
}

/**
 * Compare deux signatures hexadécimales sans fuite de temps.
 *
 * `timingSafeEqual` lève si les longueurs diffèrent — d'où le test préalable.
 * Une comparaison par `===` sur une chaîne s'arrête au premier octet
 * différent : le temps de réponse révèle alors combien de caractères sont
 * corrects, et une signature se devine octet par octet.
 */
function egalesSansFuite(attendue: string, recue: string): boolean {
    const a = Buffer.from(attendue, 'hex');
    const b = Buffer.from(recue, 'hex');
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

/**
 * @param corpsBrut Les octets reçus, exactement tels qu'ils sont arrivés.
 * @param entete    Contenu de `X-Ewuang-Signature`.
 * @param secret    Secret du webhook, distinct de la clé d'API.
 * @param maintenant Injectable pour les tests ; par défaut l'horloge.
 */
export function verifierSignatureEwuang(
    corpsBrut: Buffer | undefined,
    entete: string | undefined,
    secret: string | undefined,
    maintenant: Date = new Date(),
): ResultatVerification {
    // Secret absent de la configuration : on refuse TOUT. Accepter « parce
    // qu'on ne peut pas vérifier » transformerait un oubli de variable
    // d'environnement en endpoint ouvert à qui connaît l'URL.
    if (!secret) {
        return { valide: false, motif: 'Secret de webhook non configuré' };
    }
    if (!corpsBrut || corpsBrut.length === 0) {
        return { valide: false, motif: 'Corps brut indisponible' };
    }
    if (!entete) {
        return { valide: false, motif: 'En-tête X-Ewuang-Signature absent' };
    }

    const paires = lireEntete(entete);
    if (!paires) {
        return { valide: false, motif: 'En-tête X-Ewuang-Signature mal formé' };
    }

    // Fraîcheur AVANT le calcul : un rejeu porte une signature parfaitement
    // valide, c'est l'horodatage et lui seul qui le disqualifie.
    const ecartSecondes = Math.abs(
        Math.floor(maintenant.getTime() / 1000) - Number(paires.t),
    );
    if (ecartSecondes > FENETRE_SIGNATURE_SECONDES) {
        return {
            valide: false,
            motif: `Horodatage hors fenêtre (${ecartSecondes} s d'écart)`,
        };
    }

    const attendue = createHmac('sha256', secret)
        .update(`${paires.t}.`)
        .update(corpsBrut)
        .digest('hex');

    if (!egalesSansFuite(attendue, paires.v1)) {
        return { valide: false, motif: 'Signature invalide' };
    }

    return { valide: true };
}
