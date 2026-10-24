import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TypeClient } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

export class ProfilClientDto {
    @ApiProperty({ enum: TypeClient, example: TypeClient.BOUTIQUE })
    @IsEnum(TypeClient, {
        message: `Veuillez fournir un type de client valide : ${Object.values(TypeClient).join(', ')}`,
    })
    type: TypeClient;

    @ApiPropertyOptional({
        example: 'Librairie du Rond-Point',
        description: "Nom de l'entreprise ou de la boutique. Obligatoire pour ces deux types, ignoré pour un particulier.",
    })
    // Exigée seulement quand elle a un sens : un particulier n'en a pas.
    @ValidateIf((dto: ProfilClientDto) => dto.type !== TypeClient.PARTICULIER)
    @Transform(nettoyer)
    @IsString({ message: 'Veuillez fournir une raison sociale valide' })
    @IsNotEmpty({ message: "Veuillez fournir le nom de l'entreprise ou de la boutique" })
    @MaxLength(150)
    raisonSociale?: string;

    @ApiProperty({ example: 'Marc', description: 'Prénom de la personne à contacter' })
    @Transform(nettoyer)
    @IsString({ message: 'Veuillez fournir un prénom valide' })
    @IsNotEmpty({ message: 'Veuillez fournir un prénom' })
    @MaxLength(100)
    firstname: string;

    @ApiProperty({ example: 'Obame', description: 'Nom de la personne à contacter' })
    @Transform(nettoyer)
    @IsString({ message: 'Veuillez fournir un nom valide' })
    @IsNotEmpty({ message: 'Veuillez fournir un nom' })
    @MaxLength(100)
    lastname: string;

    @ApiPropertyOptional({
        example: '+24107112233',
        description: "Téléphone Airtel. Sert de contact d'enlèvement par défaut.",
    })
    @IsOptional()
    @Transform(nettoyer)
    @IsString()
    @MaxLength(50)
    phoneAirtel?: string;

    @ApiPropertyOptional({ example: '+24162112233', description: 'Téléphone Moov' })
    @IsOptional()
    @Transform(nettoyer)
    @IsString()
    @MaxLength(50)
    phoneMoov?: string;

    @ApiPropertyOptional({
        example: 'Quartier Louis, en face de la pharmacie du Rond-Point',
        description: "Adresse du client. Sert d'adresse d'enlèvement par défaut.",
    })
    @IsOptional()
    @Transform(nettoyer)
    @IsString()
    @MaxLength(255)
    address?: string;
}
