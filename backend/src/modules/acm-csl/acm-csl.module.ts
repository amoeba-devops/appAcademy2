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
import { InquiryService } from './application/inquiry.service';
import { InquiryWorkflowService } from './application/inquiry-workflow.service';

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
      ],
      ACM_DS,
    ),
  ],
  controllers: [InquiryController, WebInquiryController],
  providers: [InquiryService, InquiryWorkflowService],
  exports: [InquiryService, InquiryWorkflowService],
})
export class AcmCslModule {}
