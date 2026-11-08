import { Injectable } from '@nestjs/common';
import { CreateHomeDto } from './dto/create-home.dto.js';
import { UpdateHomeDto } from './dto/update-home.dto.js';

@Injectable()
export class HomeService {
  create(createHomeDto: CreateHomeDto) {
    return 'This action adds a new home';
  }

  findAll() {
    return `This action returns all home`;
  }

  findOne(id: number) {
    return `This action returns a #${id} home`;
  }

  update(id: number, updateHomeDto: UpdateHomeDto) {
    return `This action updates a #${id} home`;
  }

  remove(id: number) {
    return `This action removes a #${id} home`;
  }
}
