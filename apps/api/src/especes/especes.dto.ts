import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

/** Un règlement en espèces, saisi par un ADMIN contre un reçu papier. */
export class ReglementDto {
    @ApiProperty({ example: 15_100, description: 'En FCFA.' })
    @IsInt({ message: 'Le montant doit être un nombre entier de FCFA' })
    @Min(1, { message: 'Le montant doit être positif' })
    @Max(10_000_000)
    montant: number;

    @ApiProperty({
        example: 'R-000123',
        description: "Numéro du reçu remis. Unique : un même reçu ne s'enregistre qu'une fois, ce qui absorbe un double envoi.",
    })
    @Transform(nettoyer)
    @IsString()
    @Matches(/^[A-Za-z0-9][A-Za-z0-9/._-]{0,63}$/, {
        message: 'Numéro de reçu invalide : lettres, chiffres, « / . _ - », 64 caractères au plus',
    })
    reference: string;

    @ApiPropertyOptional({ example: 'Versement au bureau de Louis' })
    @IsOptional()
    @Transform(nettoyer)
    @IsString()
    @MaxLength(255)
    note?: string;
}

export class MouvementsQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    livreurId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    clientId?: string;

    @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limite: number = 50;
}
