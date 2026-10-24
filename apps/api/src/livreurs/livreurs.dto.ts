import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    ArrayNotEmpty,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateIf,
} from 'class-validator';
import { CreateUserDto } from '../auth/authDto/create_user.dto.js';
import type { VehiculeRequis } from '../ewuang/ewuang.client.js';
import { ZONES, type Zone } from '../tarifs/grille-tarifs.js';
import { VEHICULES } from './vehicules.js';

const nettoyer = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

/** Corps de `POST /auth/register/livreur`. */
export class InscriptionLivreurDto extends CreateUserDto {
    @ApiProperty({ example: 'Jean' })
    @Transform(nettoyer)
    @IsString()
    @IsNotEmpty({ message: 'Veuillez fournir un prénom' })
    @MaxLength(100)
    firstname: string;

    @ApiProperty({ example: 'Ondo' })
    @Transform(nettoyer)
    @IsString()
    @IsNotEmpty({ message: 'Veuillez fournir un nom' })
    @MaxLength(100)
    lastname: string;

    @ApiPropertyOptional({ example: '+24107445566', description: 'Au moins un des deux téléphones est exigé.' })
    // Obligatoire seulement si le numéro Moov manque : le client et
    // l'expéditeur doivent pouvoir joindre le livreur.
    @ValidateIf((dto: InscriptionLivreurDto) => !dto.phoneMoov)
    @Transform(nettoyer)
    @IsString()
    @IsNotEmpty({ message: 'Veuillez fournir au moins un numéro de téléphone' })
    @MaxLength(50)
    phoneAirtel?: string;

    @ApiPropertyOptional({ example: '+24162445566' })
    @IsOptional()
    @Transform(nettoyer)
    @IsString()
    @MaxLength(50)
    phoneMoov?: string;

    @ApiProperty({ enum: VEHICULES })
    @IsIn(VEHICULES, { message: `Veuillez fournir un véhicule valide : ${VEHICULES.join(', ')}` })
    type_vehicule: VehiculeRequis;

    @ApiPropertyOptional({ example: 'GA-1234-LV' })
    @IsOptional()
    @Transform(nettoyer)
    @IsString()
    @MaxLength(30)
    immatriculation?: string;

    @ApiProperty({
        enum: ZONES,
        isArray: true,
        description: "Zones où le livreur prend ses courses (zone d'enlèvement).",
    })
    @IsArray()
    @ArrayNotEmpty({ message: 'Choisissez au moins une zone' })
    @ArrayUnique()
    @IsIn(ZONES, { each: true, message: `Zone invalide. Zones possibles : ${ZONES.join(', ')}` })
    zones: Zone[];
}

export class DisponibiliteDto {
    @ApiProperty({ description: 'En service : le livreur reçoit les courses disponibles.' })
    @IsBoolean({ message: 'en_service doit être vrai ou faux' })
    en_service: boolean;
}

/** Une étape où le livreur peut avoir encaissé de l'argent. */
export class EncaissementDto {
    @ApiPropertyOptional({
        example: 2000,
        description:
            "Espèces reçues à cette étape, en FCFA. Le montant exact dû est exigé (pas de paiement partiel) ; absent quand rien n'est dû.",
    })
    @IsOptional()
    @IsInt({ message: 'Le montant encaissé doit être un nombre entier de FCFA' })
    @Min(0)
    montant_encaisse?: number;
}

export class LivrerDto extends EncaissementDto {
    @ApiProperty({ example: '4817', description: 'Code de remise dicté par le destinataire.' })
    @IsString()
    @Matches(/^\d{4}$/, { message: 'Le code de remise compte 4 chiffres' })
    code: string;
}

/** Motifs d'échec de remise, ceux de la v2 du contrat Ewuang (§3). */
export const MOTIFS_ECHEC = {
    absent: 'Destinataire absent',
    injoignable: 'Destinataire injoignable',
    refus_paiement: 'Le destinataire refuse de payer',
    refus_colis: 'Le destinataire refuse le colis',
    adresse_introuvable: 'Adresse introuvable',
} as const;
export type MotifEchec = keyof typeof MOTIFS_ECHEC;

export class EchecDto {
    @ApiProperty({ enum: Object.keys(MOTIFS_ECHEC) })
    @IsIn(Object.keys(MOTIFS_ECHEC), {
        message: `Motif invalide : ${Object.keys(MOTIFS_ECHEC).join(', ')}`,
    })
    motif: MotifEchec;
}

export class PositionDto {
    @ApiProperty({ example: 0.4162 })
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number;

    @ApiProperty({ example: 9.4673 })
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number;
}

export class RefusDossierDto {
    @ApiProperty({ example: "Pièce d'identité expirée", description: 'Lu par le livreur dans son application.' })
    @Transform(nettoyer)
    @IsString()
    @MinLength(3, { message: 'Indiquez le motif du refus' })
    @MaxLength(255)
    motif: string;
}
