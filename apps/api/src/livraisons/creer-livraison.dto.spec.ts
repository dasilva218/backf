import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreerLivraisonDto, PLAFOND_MARCHANDISE } from './creer-livraison.dto.js';

/**
 * Le bloc `paiement` : c'est lui qui dit au livreur combien encaisser, et
 * auprès de qui. Une valeur mal bornée ici finirait en espèces mal comptées.
 */

const BASE = {
    zone_depart: 'Libreville',
    zone_arrivee: 'Akanda',
    type_course: 'standard',
    destinataire: { nom: 'Awa Mbadinga', adresse: 'Angondjé', contact: '+24106998877' },
    colis: { description: '2 cartons' },
};

async function erreursPaiement(paiement: unknown) {
    const dto = plainToInstance(CreerLivraisonDto, { ...BASE, paiement });
    const erreurs = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    return erreurs.filter((e) => e.property === 'paiement');
}

describe('CreerLivraisonDto.paiement', () => {
    it('accepte un payeur seul', async () => {
        expect(await erreursPaiement({ payeur: 'expediteur' })).toHaveLength(0);
    });

    it('accepte une marchandise au plafond', async () => {
        expect(
            await erreursPaiement({ payeur: 'destinataire', montant_marchandise: PLAFOND_MARCHANDISE }),
        ).toHaveLength(0);
    });

    it('exige le bloc paiement', async () => {
        expect(await erreursPaiement(undefined)).not.toHaveLength(0);
    });

    it('refuse un payeur inconnu', async () => {
        expect(await erreursPaiement({ payeur: 'boutique' })).not.toHaveLength(0);
    });

    it('refuse une marchandise au-delà du plafond', async () => {
        expect(
            await erreursPaiement({ payeur: 'destinataire', montant_marchandise: PLAFOND_MARCHANDISE + 1 }),
        ).not.toHaveLength(0);
    });

    it('refuse un montant négatif ou décimal', async () => {
        expect(await erreursPaiement({ payeur: 'destinataire', montant_marchandise: -1 })).not.toHaveLength(0);
        expect(await erreursPaiement({ payeur: 'destinataire', montant_marchandise: 1500.5 })).not.toHaveLength(0);
    });

    it('refuse un champ de montant que le client voudrait imposer', async () => {
        expect(await erreursPaiement({ payeur: 'expediteur', frais: 0 })).not.toHaveLength(0);
    });
});
