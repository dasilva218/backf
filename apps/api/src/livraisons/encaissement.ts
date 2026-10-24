import { Payeur } from '@prisma/client';
import { calculerCommission } from '../tarifs/grille-tarifs.js';

/**
 * Ce que le livreur encaisse, à quel moment, et ce qu'il gagne.
 *
 * Fonctions pures : c'est ici, et nulle part ailleurs dans l'API, que se
 * calcule l'argent d'une course. Le front web en a un miroir
 * (`calculerEncaissements` dans apps/web/lib/affichage.ts) pour l'affichage
 * seulement : l'API seule fait foi.
 */

/**
 * Forfait versé au livreur pour rapporter un colis à l'expéditeur après un
 * échec de remise, à la charge de find_delivery (règle R3). Constante, comme
 * les plafonds du registre (src/especes/especes.ts) : pas de table de
 * paramètres tant qu'aucun écran ADMIN ne les édite.
 */
export const FORFAIT_RETOUR = 500;

export interface Encaissements {
    /** Payé par l'expéditeur au livreur, à l'enlèvement. */
    enlevement: number;
    /** Payé par le destinataire au livreur, à la remise. */
    remise: number;
}

/**
 * Les frais sont payés par le payeur choisi ; la marchandise l'est toujours
 * par le destinataire, à la remise (v2 du contrat Ewuang, §2).
 */
export function calculerEncaissements(
    tarif: number,
    payeur: Payeur,
    montantMarchandise: number,
): Encaissements {
    return payeur === Payeur.EXPEDITEUR
        ? { enlevement: tarif, remise: montantMarchandise }
        : { enlevement: 0, remise: tarif + montantMarchandise };
}

/**
 * Frais encaissés auprès de l'expéditeur quand le colis lui revient (R3).
 *
 * Il doit l'aller, que le destinataire n'a pas payé. S'il l'a déjà payé à
 * l'enlèvement, il ne doit rien de plus : le retour n'est pas facturé, et il
 * n'est pas remboursé non plus.
 */
export function aEncaisserAuRetour(tarif: number, payeur: Payeur): number {
    return payeur === Payeur.DESTINATAIRE ? tarif : 0;
}

/**
 * Gain du livreur find_delivery : 95 % du prix client, comme un livreur
 * Ewuang (décision D6). Même arrondi que la commission, pour que
 * `tarif = commission + rémunération` tienne toujours.
 */
export function calculerRemunerationLivreur(tarif: number): number {
    return tarif - calculerCommission(tarif);
}
