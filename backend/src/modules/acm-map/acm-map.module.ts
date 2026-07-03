import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { MapPassageTypeormEntity } from './infrastructure/typeorm/map-passage.typeorm-entity';
import { MapQuestionTypeormEntity } from './infrastructure/typeorm/map-question.typeorm-entity';
// MAP domain entities for the PostgreSQL ACM datasource.
import { MapPassageAssetTypeormEntity } from './infrastructure/typeorm/map-passage-asset.typeorm-entity';
import { MapItemTypeormEntity } from './infrastructure/typeorm/map-item.typeorm-entity';
import { MapItemTagTypeormEntity } from './infrastructure/typeorm/map-item-tag.typeorm-entity';
import { MapTestSetTypeormEntity } from './infrastructure/typeorm/map-test-set.typeorm-entity';
import { MapTestSetItemTypeormEntity } from './infrastructure/typeorm/map-test-set-item.typeorm-entity';
import { MapAssignmentTypeormEntity } from './infrastructure/typeorm/map-assignment.typeorm-entity';
import { MapResponseTypeormEntity } from './infrastructure/typeorm/map-response.typeorm-entity';
import { MapScoreTypeormEntity } from './infrastructure/typeorm/map-score.typeorm-entity';
import { MpqService } from './application/mpq.service';
import { MpqImportService } from './application/mpq-import.service';
import { MapAssignmentService } from './application/services/map-assignment.service';
import { MapTestSetService } from './application/services/map-test-set.service';
import { MpqController } from './presentation/mpq.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        MapPassageTypeormEntity,
        MapQuestionTypeormEntity,
        MapPassageAssetTypeormEntity,
        MapItemTypeormEntity,
        MapItemTagTypeormEntity,
        MapTestSetTypeormEntity,
        MapTestSetItemTypeormEntity,
        MapAssignmentTypeormEntity,
        MapResponseTypeormEntity,
        MapScoreTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  controllers: [MpqController],
  providers: [MpqService, MpqImportService, MapAssignmentService, MapTestSetService],
  exports: [MpqService, MapAssignmentService, MapTestSetService],
})
export class AcmMapModule {}
