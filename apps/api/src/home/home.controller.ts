import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { HomeService } from './home.service.js';
import { CreateHomeDto } from './dto/create-home.dto.js';
import { UpdateHomeDto } from './dto/update-home.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) { }

  @Public()
  @Get()
  findAll() {
    return 'Hello world';
  }


}
