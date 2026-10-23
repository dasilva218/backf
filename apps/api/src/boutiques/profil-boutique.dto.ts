import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

export class ProfilBoutiqueDto {
    @ApiProperty({ example: 'Marc', description: 'Prénom du responsable' })
    @Transform(nettoyer)
    @IsString({ message: 'Veuillez fournir un prénom valide' })
    @IsNotEmpty({ message: 'Veuillez fournir un prénom' })
    @MaxLength(100)
    firstname: string;

    @ApiProperty({ example: 'Obame', description: 'Nom du responsable' })
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
        description: "Adresse de la boutique. Sert d'adresse d'enlèvement par défaut.",
    })
    @IsOptional()
    @Transform(nettoyer)
    @IsString()
    @MaxLength(255)
    address?: string;
}
