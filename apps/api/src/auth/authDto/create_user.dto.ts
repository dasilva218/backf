import { UserRole } from "@prisma/client";
import { IsString, IsEmail, IsEnum, IsNotEmpty, MinLength } from "class-validator";
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
    @MinLength(6, {
        message: 'Le mot de passe doit contenir au moins 6 caractères'
    })
    password: string;


    @ApiProperty({
        example: "BOUTIQUE",
        enum: UserRole,
        description: "Rôle de l'utilisateur",
        required: true
    })
    @IsEnum(UserRole, {
        message: 'Veuillez fournir un rôle valide'
    })
    @IsNotEmpty({
        message: 'Veuillez fournir un rôle'
    })
    role: UserRole;
}