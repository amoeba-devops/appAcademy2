import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { ImportService } from './application/import.service';
import { StudentService } from './application/student.service';
import { StudentTypeormEntity } from './infrastructure/typeorm/student.typeorm-entity';
import { StudentController } from './presentation/student.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StudentTypeormEntity], ACM_DS),
  ],
  controllers: [StudentController],
  providers: [StudentService, ImportService],
  exports: [StudentService],
})
export class AcmStdModule {}
