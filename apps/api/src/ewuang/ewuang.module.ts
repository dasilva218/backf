import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EwuangClient } from './ewuang.client.js';
import { EwuangWebhookController } from './ewuang-webhook.controller.js';
import { EwuangWebhookService } from './ewuang-webhook.service.js';

/**
 * Intégration Ewuang : le dispatch des courses vers sa flotte, et le retour de
 * suivi par webhook.
 *
 * `EwuangClient` est exporté parce que c'est le service des courses qui
 * l'appelle au moment où un vendeur soumet une livraison. Le webhook, lui, ne
 * sort pas de ce module.
 */
@Module({
    imports: [PrismaModule],
    controllers: [EwuangWebhookController],
    providers: [EwuangClient, EwuangWebhookService],
    exports: [EwuangClient],
})
export class EwuangModule { }
