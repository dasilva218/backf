import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from '../auth/authDto/create_user.dto.js';
import { Prisma, UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * fonction qui recupère tout les utilisateurs
     * @returns 
     */
    async findAllUsers() {
        try {
            return this.prisma.user.findMany({
                omit: { password: true },
                orderBy: { createdAt: 'desc' },
            });
        } catch (error) {
            throw new BadRequestException("Impossible de recuperer les utilisateurs")
        }
    }






    /**
     * fonction qui recupère un utilisateur selon l'email
     * @param email 
     * @returns 
     */
    async findByEmail(email: string) {
        try {
            return await this.prisma.user.findUnique({
                where: { email: email.toLowerCase() },
            });
        } catch (error) {
            throw new BadRequestException("Impossible de recuperer les utilisateurs")
        }

    }

    /**
     * fonction qui recupère un utilisateur selon l'id
     * @param string 
     * @returns 
     */
    async findById(id: string) {
        try {
            return await this.prisma.user.findUnique({
                where: { id },
                omit: { password: true },
            });
        } catch (error) {
            throw new BadRequestException("Impossible de recuperer les utilisateurs")
        }

    }


    /**
     * fonction qui crée un utilisateur selon le rôle
     * @param data 
     * @return 
     */
    async create(data: Prisma.UserCreateInput) {
        try {
            return await this.prisma.user.create(
                {
                    data: { ...data },
                    omit: { password: true }
                }
            )
        } catch (error) {
            // P2002 = violation de la contrainte d'unicité (email déjà pris)
            if (
                error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
            ) {
                throw new ConflictException('Cet email est déjà utilisé');
            }
            throw error;
        }
    }


}
