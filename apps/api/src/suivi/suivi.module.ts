import { Module } from '@nestjs/common';
import { EwuangModule } from '../ewuang/ewuang.module.js';
import { SuiviController } from './suivi.controller.js';
import { SuiviService } from './suivi.service.js';

/** Position des livreurs pour la fiche d'une course et la carte ADMIN. */
@Module({
  imports: [EwuangModule],
  controllers: [SuiviController],
  providers: [SuiviService],
})
export class SuiviModule {}
