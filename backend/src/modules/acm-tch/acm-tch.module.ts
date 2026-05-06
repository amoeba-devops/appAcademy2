import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AcmAuthModule } from '../acm-auth/acm-auth.module';
import { TeacherService } from './application/teacher.service';
import { TeacherTypeormEntity } from './infrastructure/typeorm/teacher.typeorm-entity';
import { TeacherController } from './presentation/teacher.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeacherTypeormEntity], ACM_DS),
    AcmAuthModule,
  ],
  controllers: [TeacherController],
  providers: [TeacherService],
  exports: [TeacherService],
})
export class AcmTchModule {}
