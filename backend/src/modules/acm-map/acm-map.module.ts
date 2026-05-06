import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { MapPassageTypeormEntity } from './infrastructure/typeorm/map-passage.typeorm-entity';
import { MapQuestionTypeormEntity } from './infrastructure/typeorm/map-question.typeorm-entity';
import { MpqService } from './application/mpq.service';
import { MpqImportService } from './application/mpq-import.service';
import { MpqController } from './presentation/mpq.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [MapPassageTypeormEntity, MapQuestionTypeormEntity],
      ACM_DS,
    ),
  ],
  controllers: [MpqController],
  providers: [MpqService, MpqImportService],
  exports: [MpqService],
})
export class AcmMapModule {}
