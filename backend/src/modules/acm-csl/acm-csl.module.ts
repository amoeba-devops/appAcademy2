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
// PLN-260706 — CLASS_STARTED student/parent auto-registration + portal accounts
import { CslEnrollmentRegistrationService } from './application/csl-enrollment-registration.service';
import { AcmAuthModule } from '../acm-auth/acm-auth.module';
import { StudentTypeormEntity } from '../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { ParentTypeormEntity } from '../acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { StudentParentTypeormEntity } from '../acm-std/infrastructure/typeorm/student-parent.typeorm-entity';
// REQ-260630 PDF improvement — teacher lookup for the level-test report
import { TeacherTypeormEntity } from '../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
// REQ-260626 T-13 — level-test result PDF
import { LevelTestPdfService } from './application/level-test-pdf.service';
// REQ-260626 T-08 — CAL event linkage on level-test + demo-class scheduling
import { CslCalLinkerService } from './application/csl-cal-linker.service';
import { AcmCalModule } from '../acm-cal/acm-cal.module';
import { AcmSystemModule } from '../acm-system/acm-system.module';
// REQ-260626 T-20 v2.1 — attachment download audit_log persistence
import { AcmAuditModule } from '../acm-audit/acm-audit.module';
// REQ-260626 T-06 / ADR-008 — attachment upload (MinIO/S3)
import { AttachmentService } from './application/attachment.service';
import { ObjectStoreClient } from './infrastructure/external/object-store.client';

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
        // PLN-260706 — parent + link tables for CLASS_STARTED auto-registration.
        ParentTypeormEntity,
        StudentParentTypeormEntity,
        // REQ-260630 — read-only access for the level-test PDF teacher block.
        TeacherTypeormEntity,
      ],
      ACM_DS,
    ),
    AcmCalModule,
    AcmSystemModule, // REQ-260903F — TenantSettingsService (링커 TZ 변환)
    AcmAuditModule,
    // PLN-260706 — PortalAccountService for auto-issuing portal login accounts.
    AcmAuthModule,
  ],
  controllers: [InquiryController, WebInquiryController, CourseController],
  providers: [
    InquiryService,
    InquiryWorkflowService,
    TeacherAssignmentService,
    CourseService,
    StdInheritanceService,
    CslEnrollmentRegistrationService,
    LevelTestPdfService,
    CslCalLinkerService,
    AttachmentService,
    ObjectStoreClient,
  ],
  exports: [
    InquiryService,
    InquiryWorkflowService,
    TeacherAssignmentService,
    CourseService,
    StdInheritanceService,
    LevelTestPdfService,
    CslCalLinkerService,
    AttachmentService,
  ],
})
export class AcmCslModule {}
