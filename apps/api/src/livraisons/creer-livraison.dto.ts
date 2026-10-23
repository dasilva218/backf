import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsIn,
    IsISO8601,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import type { TypeCourse, VehiculeRequis } from '../ewuang/ewuang.client.js';
import { TYPES_COURSE, ZONES, type Zone } from '../tarifs/grille-tarifs.js';

/**
 * Corps de `POST /livraisons`.
 *
 * Les longueurs maximales sont celles qu'Ewuang impose dans son schéma de
 * `POST /partenaires/missions`. Les reprendre ici fait échouer la requête chez
 * nous, en 400 lisible, plutôt que chez Ewuang après l'enregistrement de la
 * course.
 */

const VEHICULES = ['moto', 'voiture', 'camionnette'] as const satisfies readonly VehiculeRequis[];

const MESSAGE_ZONE = `Veuillez fournir une zone valide : ${ZONES.join(', ')}`;

const nettoyer = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

export class EnlevementDto {
    @ApiPropertyOptional({
        example: 'Quartier Louis, en face de la pharmacie du Rond-Point',
        description: "Adresse d'enlèvement. Absente : l'adresse du profil boutique.",
    })
    @IsOptional()
    @Transform(nettoyer)
    @IsString()
    @IsNotEmpty({ message: "L'adresse d'enlèvement ne peut pas être vide" })
    @MaxLength(255)
    adresse?: string;

    @ApiPropertyOptional({
        example: '+24107112233',
        description: "Téléphone de l'expéditeur. Absent : un téléphone du profil boutique.",
    })
    @IsOptional()
    @Transform(nettoyer)
    @IsString()
    @IsNotEmpty({ message: "Le contact d'enlèvement ne peut pas être vide" })
    @MaxLength(50)
    contact?: string;

    @ApiPropertyOptional({ example: "Demander Marc à l'accueil" })
    @IsOptional()
    @Transform(nettoyer)
    @IsString()
    @MaxLength(255)
    instructions?: string;
}

export class DestinataireDto {
    @ApiProperty({ example: 'Awa Mbadinga' })
    @Transform(nettoyer)
    @IsString()
    @IsNotEmpty({ message: 'Veuillez fournir le nom du destinataire' })
    @MaxLength(120)
    nom: string;

    @ApiProperty({ example: 'Akanda, Angondjé, villa bleue après le carrefour' })
    @Transform(nettoyer)
    @IsString()
    @IsNotEmpty({ message: "Veuillez fournir l'adresse du destinataire" })
    @MaxLength(255)
    adresse: string;

    @ApiProperty({
        example: '+24106998877',
        description: 'Numéro auquel le code de remise doit être transmis.',
    })
    @Transform(nettoyer)
    @IsString()
    @IsNotEmpty({ message: 'Veuillez fournir le contact du destinataire' })
    @MaxLength(50)
    contact: string;
}

export class ColisDto {
    @ApiProperty({ example: '2 cartons de fournitures', description: 'Affiché au livreur' })
    @Transform(nettoyer)
    @IsString()
    @IsNotEmpty({ message: 'Veuillez décrire le colis' })
    @MaxLength(255)
    description: string;

    @ApiPropertyOptional({
        enum: VEHICULES,
        description:
            'Restreint réellement le dispatch : plus le gabarit est grand, plus le vivier de livreurs se réduit.',
    })
    @IsOptional()
    @IsIn(VEHICULES, {
        message: `Veuillez fournir un véhicule valide : ${VEHICULES.join(', ')}`,
    })
    vehicule_requis?: VehiculeRequis;
}

export class CreerLivraisonDto {
    @ApiProperty({ enum: ZONES, example: 'Libreville', description: "Zone d'enlèvement du colis" })
    @IsIn(ZONES, { message: `Zone de départ invalide. ${MESSAGE_ZONE}` })
    zone_depart: Zone;

    @ApiProperty({ enum: ZONES, example: 'Akanda', description: 'Zone de remise au destinataire' })
    @IsIn(ZONES, { message: `Zone d'arrivée invalide. ${MESSAGE_ZONE}` })
    zone_arrivee: Zone;

    @ApiProperty({ enum: TYPES_COURSE, example: 'standard' })
    @IsIn(TYPES_COURSE, {
        message: `Veuillez fournir un type de course valide : ${TYPES_COURSE.join(', ')}`,
    })
    type_course: TypeCourse;

    @ApiPropertyOptional({ type: EnlevementDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => EnlevementDto)
    enlevement?: EnlevementDto;

    @ApiProperty({ type: DestinataireDto })
    @ValidateNested()
    @Type(() => DestinataireDto)
    destinataire: DestinataireDto;

    @ApiProperty({ type: ColisDto })
    @ValidateNested()
    @Type(() => ColisDto)
    colis: ColisDto;

    @ApiPropertyOptional({
        example: '2026-10-23T09:00:00+01:00',
        description: 'ISO 8601 avec fuseau. Indicatif : aucun délai garanti.',
    })
    @IsOptional()
    @IsISO8601({ strict: true }, { message: 'date_souhaitee doit être une date ISO 8601' })
    // Ewuang exige le fuseau : une date naïve serait lue en UTC, une heure
    // avant l'heure voulue au Gabon.
    @Matches(/(Z|[+-]\d{2}:\d{2})$/, {
        message: 'date_souhaitee doit préciser son fuseau (Z ou +01:00)',
    })
    date_souhaitee?: string;
}
