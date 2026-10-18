import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {

    @ApiProperty({ example: "login@gmail.com", description: 'Adresse email de l\'utilisateur' })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
    @IsEmail({ blacklisted_chars: " `~±!@#$%^&*()_+[]{};':\"\\|,.<>/?" }, {
        message: 'Veuillez fournir une adresse e-mail valide'
    })
    @IsNotEmpty({
        message: 'Veuillez fournir une adresse e-mail'
    })
    email: string;


    @ApiProperty({ example: 'password', description: 'Mot de passe de l\'utilisateur' })
    @IsString()
    @MinLength(4, { message: 'Le mot de passe doit contenir au moins 4 caractères' })
    @IsNotEmpty({ message: 'Mot de passe requis' })
    password: string;
}