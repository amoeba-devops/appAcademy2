import { PartialType } from '@nestjs/swagger';
import { CreatePassageDto } from './create-passage.dto';

export class UpdatePassageDto extends PartialType(CreatePassageDto) {}