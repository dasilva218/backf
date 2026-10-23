import { IsString, IsEmail, IsNotEmpty, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class CreateUserDto {
    @ApiProperty({
        example: "[EMAIL_ADDRESS]",
        description: "Adresse e-mail de l'utilisateur",
        required: true,
    })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
    @IsNotEmpty({
        message: 'Veuillez fournir une adresse e-mail'
    })
    @IsEmail({ blacklisted_chars: " `~±!@#$%^&*()_+[]{};':\"\\|,.<>/?" }, {
        message: 'Veuillez fournir une adresse e-mail valide'
    })
    email: string;


    @ApiProperty({
        example: "password",
        description: "Mot de passe de l'utilisateur",
        required: true
    })
    @IsNotEmpty({
        message: 'Veuillez fournir un mot de passe'
    })
    @IsString({
        message: 'Veuillez fournir un mot de passe valide'
    })
    @MinLength(10, {
        message: 'Le mot de passe doit contenir au moins 10 caractères'
    })
    // bcrypt ignore tout au-delà de 72 octets : un plafond évite de laisser
    // croire qu'un mot de passe plus long serait plus sûr, et borne le hachage.
    @MaxLength(72, {
        message: 'Le mot de passe ne doit pas dépasser 72 caractères'
    })
    password: string;

    // Pas de champ `role` : l'inscription publique crée toujours une BOUTIQUE.
    // Un rôle lu dans le corps permettait à n'importe qui de s'inscrire ADMIN.
}