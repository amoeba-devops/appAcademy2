import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AcmAuthModule } from '../acm-auth/acm-auth.module';
import { AcmUserTypeormEntity } from '../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { TeacherService } from './application/teacher.service';
import { TeacherAttachmentService } from './application/teacher-attachment.service';
import { TeacherTypeormEntity } from './infrastructure/typeorm/teacher.typeorm-entity';
import { TeacherAttachmentTypeormEntity } from './infrastructure/typeorm/teacher-attachment.typeorm-entity';
import { TeacherController } from './presentation/teacher.controller';
import { TeacherAttachmentController } from './presentation/teacher-attachment.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [TeacherTypeormEntity, TeacherAttachmentTypeormEntity, AcmUserTypeormEntity],
      ACM_DS,
    ),
    AcmAuthModule,
  ],
  controllers: [TeacherController, TeacherAttachmentController],
  providers: [TeacherService, TeacherAttachmentService],
  exports: [TeacherService],
})
export class AcmTchModule {}
