import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfilBoutiqueDto } from './profil-boutique.dto.js';

/**
 * Profil métier d'un compte BOUTIQUE.
 *
 * `POST /auth/register` ne crée que le `User` : le profil se remplit ici,
 * ensuite. Il est obligatoire pour soumettre une course, parce que
 * `Livraison.boutiqueId` pointe sur `Boutique.id` et non sur `User.id`.
 */
@Injectable()
export class BoutiquesService {
    constructor(private readonly prisma: PrismaService) { }

    async lireProfil(userId: string) {
        const profil = await this.prisma.boutique.findUnique({
            where: { userBoutiqueId: userId },
        });
        if (!profil) {
            throw new NotFoundException('Profil boutique non renseigné');
        }
        return profil;
    }

    /** Création au premier appel, mise à jour ensuite. */
    enregistrerProfil(userId: string, dto: ProfilBoutiqueDto) {
        const donnees = {
            firstname: dto.firstname,
            lastname: dto.lastname,
            phoneAirtel: dto.phoneAirtel,
            phoneMoov: dto.phoneMoov,
            address: dto.address,
        };
        return this.prisma.boutique.upsert({
            where: { userBoutiqueId: userId },
            create: { ...donnees, userBoutiqueId: userId },
            update: donnees,
        });
    }
}
