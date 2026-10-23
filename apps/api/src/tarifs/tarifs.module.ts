import { Module } from '@nestjs/common';
import { TarifsController } from './tarifs.controller.js';

/**
 * Tarifs des courses. Le calcul vit dans `grille-tarifs.ts`, en fonctions
 * pures : le futur module des courses les importera directement pour poser
 * `tarif` et `commission` à la création, sans passer par ce module.
 */
@Module({
    controllers: [TarifsController],
})
export class TarifsModule { }
