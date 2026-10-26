import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole, type User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { SuiviService } from './suivi.service.js';

type Utilisateur = Omit<User, 'password'>;

/**
 * Suivi en direct. Les écrans interrogent toutes les 15 s : chaque compte a
 * son propre seau de 100 requêtes/min (ThrottlerParCompteGuard), et la flotte
 * Ewuang n'est lue qu'une fois par fenêtre quel que soit le nombre d'écrans.
 */
@ApiTags('Suivi')
@Controller()
export class SuiviController {
  constructor(private readonly suivi: SuiviService) {}

  @Get('livraisons/:id/suivi')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({
    summary:
      "Position du livreur d'une course, pendant qu'il a le colis en main",
    description:
      "`position` est null tant qu'aucune position n'est connue ; `perimee` au-delà de 5 min. `trace` : le trajet depuis l'acceptation (flotte find_delivery seulement). `flotteIndisponible` : Ewuang n'a pas pu être lu.",
  })
  @ApiResponse({ status: 404, description: 'Course introuvable.' })
  suiviCourse(@CurrentUser() user: Utilisateur, @Param('id') id: string) {
    return this.suivi.suiviCourse(user, id);
  }

  @Get('admin/carte')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Courses en main des deux flottes, avec la position de chaque livreur',
  })
  carte() {
    return this.suivi.carte();
  }
}
