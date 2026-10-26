import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class DemandeReinitialisationDto {
  @ApiProperty({
    example: 'client@exemple.ga',
    description: 'E-mail du compte à récupérer',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsNotEmpty({ message: 'Veuillez fournir une adresse e-mail' })
  @IsEmail({}, { message: 'Veuillez fournir une adresse e-mail valide' })
  email: string;
}

export class ReinitialisationDto {
  @ApiProperty({ description: "Jeton reçu dans le lien de l'e-mail" })
  @IsString({ message: 'Lien de réinitialisation invalide' })
  @IsNotEmpty({ message: 'Lien de réinitialisation invalide' })
  @MaxLength(2000, { message: 'Lien de réinitialisation invalide' })
  jeton: string;

  // Mêmes règles que l'inscription (CreateUserDto).
  @ApiProperty({ description: 'Nouveau mot de passe, 10 à 72 caractères' })
  @IsString({ message: 'Veuillez fournir un mot de passe valide' })
  @MinLength(10, {
    message: 'Le mot de passe doit contenir au moins 10 caractères',
  })
  @MaxLength(72, {
    message: 'Le mot de passe ne doit pas dépasser 72 caractères',
  })
  password: string;
}
