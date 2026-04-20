import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherEntity } from '../infrastructure/database/entities/teacher.entity';
import { TeacherRepository } from '../infrastructure/database/repositories/teacher.repository';
import { TEACHER_REPOSITORY } from '../domain/repositories/teacher-repository.interface';
import {
  GetTeachersUseCase,
  GetTeacherDetailUseCase,
  CreateTeacherUseCase,
  UpdateTeacherUseCase,
} from '../application/use-cases/teacher/index';
import { TeacherController } from './controllers/teacher.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherEntity])],
  controllers: [TeacherController],
  providers: [
    { provide: TEACHER_REPOSITORY, useClass: TeacherRepository },
    GetTeachersUseCase,
    GetTeacherDetailUseCase,
    CreateTeacherUseCase,
    UpdateTeacherUseCase,
  ],
  exports: [TEACHER_REPOSITORY],
})
export class TeacherModule {}
