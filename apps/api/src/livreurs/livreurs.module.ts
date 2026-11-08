import { Module } from '@nestjs/common';
import { EspecesModule } from '../especes/especes.module.js';
import { EwuangModule } from '../ewuang/ewuang.module.js';
import { LivreurCoursesService } from './livreur-courses.service.js';
import { AdminCoursesController, AdminLivreursController, LivreursController } from './livreurs.controller.js';
import { LivreursService } from './livreurs.service.js';

/** La flotte propre de find_delivery : l'API de `find_delivery_mobile`. */
@Module({
    imports: [EwuangModule, EspecesModule],
    controllers: [LivreursController, AdminLivreursController, AdminCoursesController],
    providers: [LivreursService, LivreurCoursesService],
})
export class LivreursModule { }
