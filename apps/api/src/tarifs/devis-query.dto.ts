import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { TypeCourse } from '../ewuang/ewuang.client.js';
import { TYPES_COURSE, ZONES, type Zone } from './grille-tarifs.js';

const MESSAGE_ZONE = `Veuillez fournir une zone valide : ${ZONES.join(', ')}`;

export class DevisQueryDto {
    @ApiProperty({ enum: ZONES, example: 'Libreville', description: "Zone d'enlèvement du colis" })
    @IsIn(ZONES, { message: `Zone de départ invalide. ${MESSAGE_ZONE}` })
    zone_depart: Zone;

    @ApiProperty({ enum: ZONES, example: 'Owendo', description: 'Zone de remise au destinataire' })
    @IsIn(ZONES, { message: `Zone d'arrivée invalide. ${MESSAGE_ZONE}` })
    zone_arrivee: Zone;

    @ApiProperty({ enum: TYPES_COURSE, example: 'standard', description: 'Type de course' })
    @IsIn(TYPES_COURSE, {
        message: `Veuillez fournir un type de course valide : ${TYPES_COURSE.join(', ')}`,
    })
    type_course: TypeCourse;
}
