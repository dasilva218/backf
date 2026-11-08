import { PartialType } from '@nestjs/swagger';
import { CreateHomeDto } from './create-home.dto.js';

export class UpdateHomeDto extends PartialType(CreateHomeDto) {}
