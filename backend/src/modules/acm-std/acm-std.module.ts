import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AmaModule } from '../../infrastructure/external/ama/ama.module';
import { RolesGuard } from '../acm-common/guards/roles.guard';
import { ImportService } from './application/import.service';
import { ParentService } from './application/parent.service';
import { StudentService } from './application/student.service';
import { PortalTeacherStudentsService } from './application/portal-teacher-students.service';
import { ParentTypeormEntity } from './infrastructure/typeorm/parent.typeorm-entity';
import { StudentParentTypeormEntity } from './infrastructure/typeorm/student-parent.typeorm-entity';
import { StudentTypeormEntity } from './infrastructure/typeorm/student.typeorm-entity';
import { TeacherTypeormEntity } from '../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { ParentController } from './presentation/parent.controller';
import { StudentController } from './presentation/student.controller';
import { StudentParentController } from './presentation/student-parent.controller';
import { PortalTeacherStudentsController } from './presentation/portal-teacher-students.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        StudentTypeormEntity,
        ParentTypeormEntity,
        StudentParentTypeormEntity,
        TeacherTypeormEntity,
      ],
      ACM_DS,
    ),
    AmaModule,
  ],
  controllers: [
    StudentController,
    ParentController,
    StudentParentController,
    PortalTeacherStudentsController, // PLN-260719 C — 강사 포털 수강생관리
  ],
  providers: [
    StudentService,
    ImportService,
    ParentService,
    PortalTeacherStudentsService,
    RolesGuard,
  ],
  exports: [StudentService, ParentService],
})
export class AcmStdModule {}
