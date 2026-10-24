import { Injectable, NotFoundException } from '@nestjs/common';
import { TypeClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfilClientDto } from './profil-client.dto.js';

/**
 * Profil métier d'un compte CLIENT : particulier, entreprise ou boutique.
 *
 * `POST /auth/register` ne crée que le `User` : le profil se remplit ici,
 * ensuite. Il est obligatoire pour soumettre une course, parce que
 * `Livraison.clientId` pointe sur `Client.id` et non sur `User.id`.
 */
@Injectable()
export class ClientsService {
    constructor(private readonly prisma: PrismaService) { }

    async lireProfil(userId: string) {
        const profil = await this.prisma.client.findUnique({
            where: { userClientId: userId },
        });
        if (!profil) {
            throw new NotFoundException('Profil client non renseigné');
        }
        return profil;
    }

    /** Création au premier appel, mise à jour ensuite. */
    enregistrerProfil(userId: string, dto: ProfilClientDto) {
        const donnees = {
            type: dto.type,
            // Un particulier passé d'un autre type perd sa raison sociale :
            // elle ne désignerait plus rien.
            raisonSociale: dto.type === TypeClient.PARTICULIER ? null : dto.raisonSociale,
            firstname: dto.firstname,
            lastname: dto.lastname,
            phoneAirtel: dto.phoneAirtel,
            phoneMoov: dto.phoneMoov,
            address: dto.address,
        };
        return this.prisma.client.upsert({
            where: { userClientId: userId },
            create: { ...donnees, userClientId: userId },
            update: donnees,
        });
    }
}
