import { TransportMode } from '@prisma/client';
import type { VehiculeRequis } from '../ewuang/ewuang.client.js';

/**
 * Le véhicule d'un livreur find_delivery, dans le vocabulaire des courses.
 *
 * `Livreur.moyenTransport` est un enum antérieur au choix de la flotte
 * (MOTO, VOITURE, VELO, CANTER, AVION, TRAIN, BATEAU). Plutôt que de le
 * remplacer — la table n'a pas de lignes, mais retirer une colonne demande
 * l'accord de Franck — on n'en retient que les trois gabarits que connaît le
 * dispatch, ceux du contrat Ewuang. L'inscription n'accepte que ceux-là.
 */

export const VEHICULES = ['moto', 'voiture', 'camionnette'] as const satisfies readonly VehiculeRequis[];

export const TRANSPORT_PAR_VEHICULE: Record<VehiculeRequis, TransportMode> = {
    moto: TransportMode.MOTO,
    voiture: TransportMode.VOITURE,
    camionnette: TransportMode.CANTER,
};

/** Null pour un mode de transport que le dispatch ne connaît pas. */
export function vehiculeDuTransport(mode: TransportMode): VehiculeRequis | null {
    const trouve = (Object.entries(TRANSPORT_PAR_VEHICULE) as [VehiculeRequis, TransportMode][])
        .find(([, transport]) => transport === mode);
    return trouve ? trouve[0] : null;
}

/**
 * Le livreur peut-il prendre une course qui exige ce véhicule ? Même règle
 * que chez Ewuang : gabarit identique exigé, et une course sans exigence est
 * ouverte à tous.
 */
export function vehiculeCompatible(requis: VehiculeRequis | undefined, livreur: TransportMode): boolean {
    return !requis || vehiculeDuTransport(livreur) === requis;
}
