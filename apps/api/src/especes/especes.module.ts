import { Module } from '@nestjs/common';
import { AdminEspecesController, ClientEspecesController } from './especes.controller.js';
import { EspecesService } from './especes.service.js';

/** Le registre des espèces (phase 3). Exporté pour les étapes des courses. */
@Module({
    controllers: [AdminEspecesController, ClientEspecesController],
    providers: [EspecesService],
    exports: [EspecesService],
})
export class EspecesModule { }
