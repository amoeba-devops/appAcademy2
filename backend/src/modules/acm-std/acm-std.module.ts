import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { ImportService } from './application/import.service';
import { ParentService } from './application/parent.service';
import { StudentService } from './application/student.service';
import { ParentTypeormEntity } from './infrastructure/typeorm/parent.typeorm-entity';
import { StudentParentTypeormEntity } from './infrastructure/typeorm/student-parent.typeorm-entity';
import { StudentTypeormEntity } from './infrastructure/typeorm/student.typeorm-entity';
import { ParentController } from './presentation/parent.controller';
import { StudentController } from './presentation/student.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [StudentTypeormEntity, ParentTypeormEntity, StudentParentTypeormEntity],
      ACM_DS,
    ),
  ],
  controllers: [StudentController, ParentController],
  providers: [StudentService, ImportService, ParentService],
  exports: [StudentService, ParentService],
})
export class AcmStdModule {}
