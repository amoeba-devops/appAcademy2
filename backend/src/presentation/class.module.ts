import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassEntity } from '../infrastructure/database/entities/class.entity';
import { ClassSessionEntity } from '../infrastructure/database/entities/class-session.entity';
import { ClassroomEntity } from '../infrastructure/database/entities/classroom.entity';
import { ClassRepository } from '../infrastructure/database/repositories/class.repository';
import { ClassSessionRepository } from '../infrastructure/database/repositories/class-session.repository';
import { ClassroomRepository } from '../infrastructure/database/repositories/classroom.repository';
import { CLASS_REPOSITORY, CLASS_SESSION_REPOSITORY } from '../domain/repositories/class-repository.interface';
import { CLASSROOM_REPOSITORY } from '../domain/repositories/classroom-repository.interface';
import {
  GetClassesUseCase,
  GetClassDetailUseCase,
  CreateClassUseCase,
  UpdateClassUseCase,
  RecordSessionUseCase,
  GetClassroomsUseCase,
} from '../application/use-cases/class';
import { ClassController } from './controllers/class.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClassEntity, ClassSessionEntity, ClassroomEntity])],
  controllers: [ClassController],
  providers: [
    { provide: CLASS_REPOSITORY, useClass: ClassRepository },
    { provide: CLASS_SESSION_REPOSITORY, useClass: ClassSessionRepository },
    { provide: CLASSROOM_REPOSITORY, useClass: ClassroomRepository },
    GetClassesUseCase,
    GetClassDetailUseCase,
    CreateClassUseCase,
    UpdateClassUseCase,
    RecordSessionUseCase,
    GetClassroomsUseCase,
  ],
  exports: [CLASS_REPOSITORY, CLASS_SESSION_REPOSITORY, CLASSROOM_REPOSITORY],
})
export class ClassModule {}
