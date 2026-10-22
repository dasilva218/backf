import { Module } from '@nestjs/common';
import { BoutiquesController } from './boutiques.controller.js';
import { BoutiquesService } from './boutiques.service.js';

@Module({
    controllers: [BoutiquesController],
    providers: [BoutiquesService],
})
export class BoutiquesModule { }
