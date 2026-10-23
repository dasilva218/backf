import { Module } from '@nestjs/common';
import { EwuangModule } from '../ewuang/ewuang.module.js';
import { LivraisonsController } from './livraisons.controller.js';
import { LivraisonsService } from './livraisons.service.js';

@Module({
    imports: [EwuangModule],
    controllers: [LivraisonsController],
    providers: [LivraisonsService],
})
export class LivraisonsModule { }
