import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultationEntity } from '../infrastructure/database/entities/consultation.entity';
import { VisitRecordEntity } from '../infrastructure/database/entities/visit-record.entity';
import { ParentEntity } from '../infrastructure/database/entities/parent.entity';
import { ConsultationRepository } from '../infrastructure/database/repositories/consultation.repository';
import { VisitRecordRepository } from '../infrastructure/database/repositories/visit-record.repository';
import { ParentRepository } from '../infrastructure/database/repositories/parent.repository';
import {
  CONSULTATION_REPOSITORY,
  VISIT_RECORD_REPOSITORY,
} from '../domain/repositories/consultation-repository.interface';
import { PARENT_REPOSITORY } from '../domain/repositories/parent-repository.interface';
import {
  GetConsultationsUseCase,
  GetConsultationDetailUseCase,
  CreateConsultationUseCase,
  UpdateConsultationUseCase,
  UpdateConsultationStatusUseCase,
  CreateVisitRecordUseCase,
} from '../application/use-cases/consultation/index';
import { ConsultationController } from './controllers/consultation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ConsultationEntity, VisitRecordEntity, ParentEntity])],
  controllers: [ConsultationController],
  providers: [
    { provide: CONSULTATION_REPOSITORY, useClass: ConsultationRepository },
    { provide: VISIT_RECORD_REPOSITORY, useClass: VisitRecordRepository },
    { provide: PARENT_REPOSITORY, useClass: ParentRepository },
    GetConsultationsUseCase,
    GetConsultationDetailUseCase,
    CreateConsultationUseCase,
    UpdateConsultationUseCase,
    UpdateConsultationStatusUseCase,
    CreateVisitRecordUseCase,
  ],
  exports: [CONSULTATION_REPOSITORY],
})
export class ConsultationModule {}
