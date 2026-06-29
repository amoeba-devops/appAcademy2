import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { InquiryTypeormEntity } from './infrastructure/typeorm/inquiry.typeorm-entity';
import { MapTestTypeormEntity } from './infrastructure/typeorm/map-test.typeorm-entity';
import { TrialClassTypeormEntity } from './infrastructure/typeorm/trial-class.typeorm-entity';
import { EnrollmentTypeormEntity } from './infrastructure/typeorm/enrollment.typeorm-entity';
import { CancellationTypeormEntity } from './infrastructure/typeorm/cancellation.typeorm-entity';
import { TransitionTypeormEntity } from './infrastructure/typeorm/transition.typeorm-entity';
import { RemarkTypeormEntity } from './infrastructure/typeorm/remark.typeorm-entity';
import { PiiAuditTypeormEntity } from './infrastructure/typeorm/pii-audit.typeorm-entity';
// REQ-260626 Phase 1 — pipeline revision: 3 new entities.
import { AttachmentTypeormEntity } from './infrastructure/typeorm/attachment.typeorm-entity';
import { TeacherAssignmentTypeormEntity } from './infrastructure/typeorm/teacher-assignment.typeorm-entity';
import { CourseTypeormEntity } from './infrastructure/typeorm/course.typeorm-entity';
import { InquiryController } from './presentation/inquiry.controller';
import { WebInquiryController } from './presentation/web-inquiry.controller';
// REQ-260626 P2B — course master CRUD endpoints (under /acm/csl/courses)
import { CourseController } from './presentation/course.controller';
import { InquiryService } from './application/inquiry.service';
import { InquiryWorkflowService } from './application/inquiry-workflow.service';
// REQ-260626 P2B — multi-teacher assignment + course master
import { TeacherAssignmentService } from './application/teacher-assignment.service';
import { CourseService } from './application/course.service';
// REQ-260626 T-19 — MAP→STD inheritance hook
import { StdInheritanceService } from './application/std-inheritance.service';
import { StudentTypeormEntity } from '../acm-std/infrastructure/typeorm/student.typeorm-entity';
// REQ-260626 T-13 — level-test result PDF
import { LevelTestPdfService } from './application/level-test-pdf.service';
// REQ-260626 T-08 — CAL event linkage on level-test + demo-class scheduling
import { CslCalLinkerService } from './application/csl-cal-linker.service';
import { AcmCalModule } from '../acm-cal/acm-cal.module';

/**
 * acm-csl — Counseling / Inquiry Module
 * @see acm-req-csl-001 v2.1
 * Routes: /acm/csl/inquiries
 */
@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        InquiryTypeormEntity,
        MapTestTypeormEntity,
        TrialClassTypeormEntity,
        EnrollmentTypeormEntity,
        CancellationTypeormEntity,
        TransitionTypeormEntity,
        RemarkTypeormEntity,
        PiiAuditTypeormEntity,
        // REQ-260626 Phase 1
        AttachmentTypeormEntity,
        TeacherAssignmentTypeormEntity,
        CourseTypeormEntity,
        // REQ-260626 T-19 — read-only access to the STD student row from
        // the CSL module so we can copy MAP scores on CLASS_STARTED.
        StudentTypeormEntity,
      ],
      ACM_DS,
    ),
    AcmCalModule,
  ],
  controllers: [InquiryController, WebInquiryController, CourseController],
  providers: [
    InquiryService,
    InquiryWorkflowService,
    TeacherAssignmentService,
    CourseService,
    StdInheritanceService,
    LevelTestPdfService,
    CslCalLinkerService,
  ],
  exports: [
    InquiryService,
    InquiryWorkflowService,
    TeacherAssignmentService,
    CourseService,
    StdInheritanceService,
    LevelTestPdfService,
    CslCalLinkerService,
  ],
})
export class AcmCslModule {}
