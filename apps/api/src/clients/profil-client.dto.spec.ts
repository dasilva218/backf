import { TypeClient } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ProfilClientDto } from './profil-client.dto.js';

async function proprietesEnErreur(corps: Record<string, unknown>) {
    const dto = plainToInstance(ProfilClientDto, { firstname: 'Marc', lastname: 'Obame', ...corps });
    const erreurs = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    return erreurs.map((e) => e.property);
}

describe('ProfilClientDto', () => {
    it('un particulier se passe de raison sociale', async () => {
        expect(await proprietesEnErreur({ type: TypeClient.PARTICULIER })).toEqual([]);
    });

    it.each([TypeClient.ENTREPRISE, TypeClient.BOUTIQUE])('%s exige une raison sociale', async (type) => {
        expect(await proprietesEnErreur({ type })).toContain('raisonSociale');
        expect(await proprietesEnErreur({ type, raisonSociale: '   ' })).toContain('raisonSociale');
        expect(await proprietesEnErreur({ type, raisonSociale: 'Librairie du Rond-Point' })).toEqual([]);
    });

    it('exige un type connu', async () => {
        expect(await proprietesEnErreur({})).toContain('type');
        expect(await proprietesEnErreur({ type: 'ASSOCIATION' })).toContain('type');
    });
});
