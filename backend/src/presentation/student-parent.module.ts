import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentEntity } from '../infrastructure/database/entities/student.entity';
import { ParentEntity } from '../infrastructure/database/entities/parent.entity';
import { StudentRepository } from '../infrastructure/database/repositories/student.repository';
import { ParentRepository } from '../infrastructure/database/repositories/parent.repository';
import { STUDENT_REPOSITORY } from '../domain/repositories/student-repository.interface';
import { PARENT_REPOSITORY } from '../domain/repositories/parent-repository.interface';
import {
  GetStudentsUseCase,
  GetStudentDetailUseCase,
  CreateStudentUseCase,
  UpdateStudentUseCase,
} from '../application/use-cases/student/index';
import {
  GetParentsUseCase,
  GetParentDetailUseCase,
  CreateParentUseCase,
  UpdateParentUseCase,
} from '../application/use-cases/parent/index';
import { StudentController } from './controllers/student.controller';
import { ParentController } from './controllers/parent.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StudentEntity, ParentEntity])],
  controllers: [StudentController, ParentController],
  providers: [
    { provide: STUDENT_REPOSITORY, useClass: StudentRepository },
    { provide: PARENT_REPOSITORY, useClass: ParentRepository },
    GetStudentsUseCase,
    GetStudentDetailUseCase,
    CreateStudentUseCase,
    UpdateStudentUseCase,
    GetParentsUseCase,
    GetParentDetailUseCase,
    CreateParentUseCase,
    UpdateParentUseCase,
  ],
  exports: [STUDENT_REPOSITORY, PARENT_REPOSITORY],
})
export class StudentParentModule {}
