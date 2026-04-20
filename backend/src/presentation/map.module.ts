import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ClassEntity,
  EnrollmentEntity,
  MapItemEntity,
  MapItemTagEntity,
  MapAssignmentEntity,
  MapPassageAssetEntity,
  MapPassageEntity,
  ParentEntity,
  MapResponseEntity,
  MapScoreEntity,
  StudentEntity,
  StudentGuardianEntity,
  MapTestSetEntity,
  MapTestSetItemEntity,
} from '../infrastructure/database/entities';
import {
  MAP_ASSIGNMENT_REPOSITORY,
  MAP_ITEM_REPOSITORY,
  MAP_PASSAGE_REPOSITORY,
  MAP_SCORE_REPOSITORY,
  MAP_TEST_SET_REPOSITORY,
} from '../domain/repositories/map-repository.interface';
import { MapAssignmentRepository } from '../infrastructure/database/repositories/map-assignment.repository';
import { MapItemRepository } from '../infrastructure/database/repositories/map-item.repository';
import { MapPassageRepository } from '../infrastructure/database/repositories/map-passage.repository';
import { MapScoreRepository } from '../infrastructure/database/repositories/map-score.repository';
import { MapTestSetRepository } from '../infrastructure/database/repositories/map-test-set.repository';
import {
  CreateAssignmentUseCase,
  CreateTestSetUseCase,
  CreateItemUseCase,
  CreatePassageUseCase,
  GetGradingDetailUseCase,
  GetGradingQueueUseCase,
  GetHubStatsUseCase,
  GetPortalScoreHistoryUseCase,
  GetAssignmentDetailUseCase,
  GetAssignmentsUseCase,
  GetItemDetailUseCase,
  GetItemsUseCase,
  GetPassageDetailUseCase,
  GetPassagesUseCase,
  GetTestSetDetailUseCase,
  GetTestSetPreviewUseCase,
  GetTestSetsUseCase,
  GradeAssignmentUseCase,
  UpdateAssignmentUseCase,
  UpdateTestSetUseCase,
  UpdateItemUseCase,
  UpdatePassageUseCase,
} from '../application/use-cases/map';
import { MapController } from './controllers/map.controller';
import { PortalMapController } from './controllers/portal-map.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MapPassageEntity,
      MapPassageAssetEntity,
      MapItemEntity,
      MapItemTagEntity,
      MapAssignmentEntity,
      MapResponseEntity,
      MapScoreEntity,
      MapTestSetEntity,
      MapTestSetItemEntity,
      ParentEntity,
      StudentEntity,
      StudentGuardianEntity,
      ClassEntity,
      EnrollmentEntity,
    ]),
  ],
  controllers: [MapController, PortalMapController],
  providers: [
    { provide: MAP_PASSAGE_REPOSITORY, useClass: MapPassageRepository },
    { provide: MAP_ITEM_REPOSITORY, useClass: MapItemRepository },
    { provide: MAP_ASSIGNMENT_REPOSITORY, useClass: MapAssignmentRepository },
    { provide: MAP_SCORE_REPOSITORY, useClass: MapScoreRepository },
    { provide: MAP_TEST_SET_REPOSITORY, useClass: MapTestSetRepository },
    GetPassagesUseCase,
    GetPassageDetailUseCase,
    CreatePassageUseCase,
    UpdatePassageUseCase,
    GetItemsUseCase,
    GetItemDetailUseCase,
    CreateItemUseCase,
    UpdateItemUseCase,
    GetAssignmentsUseCase,
    GetAssignmentDetailUseCase,
    CreateAssignmentUseCase,
    UpdateAssignmentUseCase,
    GetGradingQueueUseCase,
    GetGradingDetailUseCase,
    GetHubStatsUseCase,
    GetPortalScoreHistoryUseCase,
    GradeAssignmentUseCase,
    GetTestSetsUseCase,
    GetTestSetDetailUseCase,
    CreateTestSetUseCase,
    UpdateTestSetUseCase,
    GetTestSetPreviewUseCase,
  ],
  exports: [MAP_PASSAGE_REPOSITORY, MAP_ITEM_REPOSITORY, MAP_ASSIGNMENT_REPOSITORY, MAP_SCORE_REPOSITORY, MAP_TEST_SET_REPOSITORY],
})
export class MapModule {}