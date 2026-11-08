import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsDefined,
    IsIn,
    IsInt,
    IsISO8601,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
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

/**
 * `camionnette` est retirée pour l'instant (décision de Franck, 2026-10-24).
 * Un livreur peut toujours s'inscrire avec une camionnette (`livreurs/vehicules.ts`).
 */
const VEHICULES = ['moto', 'voiture'] as const satisfies readonly VehiculeRequis[];

/** Le vocabulaire de la v2 du contrat Ewuang (`paiement.payeur`). */
export const PAYEURS = ['expediteur', 'destinataire'] as const;
export type PayeurDemande = (typeof PAYEURS)[number];

/**
 * Plafond du contre-remboursement, en FCFA (règle R6 du plan de lancement).
 *
 * Égal au plafond d'encours d'un livreur (R5) : au-delà, aucun livreur ne
 * pourrait accepter la course. Constante en attendant la table de paramètres
 * de la phase 3, qui le rendra réglable sans redéploiement.
 */
export const PLAFOND_MARCHANDISE = 50_000;

const MESSAGE_ZONE = `Veuillez fournir une zone valide : ${ZONES.join(', ')}`;

const nettoyer = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

export class EnlevementDto {
    @ApiPropertyOptional({
        example: 'Quartier Louis, en face de la pharmacie du Rond-Point',
        description: "Adresse d'enlèvement. Absente : l'adresse du profil client.",
    })
    @IsOptional()
    @Transform(nettoyer)
    @IsString()
    @IsNotEmpty({ message: "L'adresse d'enlèvement ne peut pas être vide" })
    @MaxLength(255)
    adresse?: string;

    @ApiPropertyOptional({
        example: '+24107112233',
        description: "Téléphone de l'expéditeur. Absent : un téléphone du profil client.",
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

export class PaiementDto {
    @ApiProperty({
        enum: PAYEURS,
        description:
            "Qui paie les frais, en espèces, au livreur : l'expéditeur à l'enlèvement, ou le destinataire à la remise.",
    })
    @IsIn(PAYEURS, {
        message: `Veuillez indiquer qui paie la course : ${PAYEURS.join(' ou ')}`,
    })
    payeur: PayeurDemande;

    @ApiPropertyOptional({
        example: 15000,
        description: `Prix de la marchandise, encaissé auprès du destinataire à la remise, pour votre compte. Entier FCFA, ${PLAFOND_MARCHANDISE} au plus. Absent ou 0 : aucun.`,
    })
    @IsOptional()
    @IsInt({ message: 'Le montant de la marchandise doit être un nombre entier de FCFA' })
    @Min(0, { message: 'Le montant de la marchandise ne peut pas être négatif' })
    @Max(PLAFOND_MARCHANDISE, {
        message: `Le montant de la marchandise ne peut pas dépasser ${PLAFOND_MARCHANDISE} FCFA`,
    })
    montant_marchandise?: number;
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
    // Même raison que `paiement` ci-dessous : sans `@IsDefined`, un bloc absent passe.
    @IsDefined({ message: 'Veuillez fournir le destinataire (nom, adresse, contact)' })
    @ValidateNested()
    @Type(() => DestinataireDto)
    destinataire: DestinataireDto;

    @ApiProperty({ type: ColisDto })
    @IsDefined({ message: 'Veuillez décrire le colis (colis.description)' })
    @ValidateNested()
    @Type(() => ColisDto)
    colis: ColisDto;

    @ApiProperty({ type: PaiementDto })
    // `@ValidateNested` seul laisse passer un bloc ABSENT : la requête
    // atteindrait le service et y lèverait une 500.
    @IsDefined({ message: 'Veuillez indiquer qui paie la course (paiement.payeur)' })
    @ValidateNested()
    @Type(() => PaiementDto)
    paiement: PaiementDto;

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
