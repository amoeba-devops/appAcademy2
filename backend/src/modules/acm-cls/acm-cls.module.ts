import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AttendanceService } from './application/attendance.service';
import { EnrollmentAdminService } from './application/enrollment-admin.service';
import { ClassService } from './application/class.service';
import { ClsJobs } from './application/cls.jobs';
import { FeedbackService } from './application/feedback.service';
import { MakeupService } from './application/makeup.service';
import { SessionService } from './application/session.service';
import { SettlementService } from './application/settlement.service';
import { AttendanceTypeormEntity } from './infrastructure/typeorm/attendance.typeorm-entity';
import { ClassStudentTypeormEntity } from './infrastructure/typeorm/class-student.typeorm-entity';
import { ClassTypeormEntity } from './infrastructure/typeorm/class.typeorm-entity';
import { FeedbackTypeormEntity } from './infrastructure/typeorm/feedback.typeorm-entity';
import { MakeupTypeormEntity } from './infrastructure/typeorm/makeup.typeorm-entity';
import { RecurrenceTypeormEntity } from './infrastructure/typeorm/recurrence.typeorm-entity';
import { SessionTypeormEntity } from './infrastructure/typeorm/session.typeorm-entity';
import { SettlementLineTypeormEntity } from './infrastructure/typeorm/settlement-line.typeorm-entity';
import { SettlementTypeormEntity } from './infrastructure/typeorm/settlement.typeorm-entity';
import { VideoConfigTypeormEntity } from './infrastructure/typeorm/video-config.typeorm-entity';
import { ClassController } from './presentation/class.controller';
import { EnrollmentController } from './presentation/enrollment.controller';
import { SessionController } from './presentation/session.controller';
import { SettlementController } from './presentation/settlement.controller';
import { ClsEnrollmentTypeormEntity } from './infrastructure/typeorm/cls-enrollment.typeorm-entity';
import { StudentTypeormEntity } from '../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { ParentTypeormEntity } from '../acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { AcmUserTypeormEntity } from '../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        ClassTypeormEntity,
        ClassStudentTypeormEntity,
        RecurrenceTypeormEntity,
        SessionTypeormEntity,
        ClsEnrollmentTypeormEntity,
        AttendanceTypeormEntity,
        MakeupTypeormEntity,
        FeedbackTypeormEntity,
        VideoConfigTypeormEntity,
        SettlementTypeormEntity,
        SettlementLineTypeormEntity,
        StudentTypeormEntity,
        ParentTypeormEntity,
        AcmUserTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  controllers: [
    ClassController,
    SessionController,
    SettlementController,
    EnrollmentController,
  ],
  providers: [
    ClassService,
    EnrollmentAdminService,
    SessionService,
    AttendanceService,
    FeedbackService,
    MakeupService,
    SettlementService,
    ClsJobs,
  ],
  exports: [SessionService, SettlementService],
})
export class AcmClsModule {}
