import { Module } from '@nestjs/common';
import { HomeService } from './home.service.js';
import { HomeController } from './home.controller.js';

@Module({
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
