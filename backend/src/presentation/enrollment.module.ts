import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CreateEnrollmentUseCase,
  GetEnrollmentsUseCase,
  UpdateEnrollmentStatusUseCase,
} from '../application/use-cases/enrollment/index.js';
import { ENROLLMENT_REPOSITORY } from '../domain/repositories/enrollment-repository.interface.js';
import { EnrollmentEntity } from '../infrastructure/database/entities/enrollment.entity';
import { EnrollmentRepository } from '../infrastructure/database/repositories/enrollment.repository';
import { EnrollmentController } from './controllers/enrollment.controller';
import { ClassModule } from './class.module';
import { StudentParentModule } from './student-parent.module';

@Module({
  imports: [TypeOrmModule.forFeature([EnrollmentEntity]), ClassModule, StudentParentModule],
  controllers: [EnrollmentController],
  providers: [
    { provide: ENROLLMENT_REPOSITORY, useClass: EnrollmentRepository },
    GetEnrollmentsUseCase,
    CreateEnrollmentUseCase,
    UpdateEnrollmentStatusUseCase,
  ],
  exports: [ENROLLMENT_REPOSITORY],
})
export class EnrollmentModule {}