import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { InquiryService } from '../application/inquiry.service';
import { InquiryWorkflowService } from '../application/inquiry-workflow.service';
import { TeacherAssignmentService } from '../application/teacher-assignment.service';
import { CourseService } from '../application/course.service';
import { LevelTestPdfService } from '../application/level-test-pdf.service';
import { CslCalLinkerService } from '../application/csl-cal-linker.service';
import { AttachmentService } from '../application/attachment.service';
import type { AcmRole } from '../../acm-common/decorators/current-user.decorator';
import {
  ApprovePaymentDto,
  AssignTeacherDto,
  ChangeStageDto,
  CreateCancellationDto,
  CreateCourseDto,
  CreateInquiryDto,
  CreateTrialClassDto,
  RecordLevelTestResultDto,
  UpdateCourseDto,
  UpdateInquiryDto,
  UpdateTrialClassDto,
  UpsertEnrollmentDto,
  UpsertLevelTestDto,
  UpsertMapTestDto,
  WriteFeedbackDto,
} from '../application/dto/inquiry.dto';
import {
  AssignDto,
  BackwardTransitionDto,
  CreateRemarkDto,
} from '../application/dto/transitions.dto';
import type { CslStage } from '../infrastructure/typeorm/inquiry.typeorm-entity';

/**
 * Inquiry endpoints — acm-req-csl-001 v2.1 6-stage pipeline.
 */
@ApiTags('acm-csl')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/csl/inquiries')
export class InquiryController {
  constructor(
    private readonly base: InquiryService,
    private readonly workflow: InquiryWorkflowService,
    private readonly teachers: TeacherAssignmentService,
    private readonly courses: CourseService,
    private readonly pdf: LevelTestPdfService,
    private readonly calLinker: CslCalLinkerService,
    private readonly attachments: AttachmentService,
  ) {}

  // ── Inquiry CRUD ────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'List inquiries' })
  list(
    @CurrentUser() user: AcmCurrentUser,
    @Query('stage') stage?: CslStage,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.base.list(user.entId, {
      stage,
      limit: Number(limit),
      offset: Number(offset),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create inquiry (INTAKE)' })
  create(@CurrentUser() user: AcmCurrentUser, @Body() dto: CreateInquiryDto) {
    return this.base.create(user.entId, dto, user.id);
  }

  @Get(':inqId')
  detail(@CurrentUser() user: AcmCurrentUser, @Param('inqId', ParseUUIDPipe) inqId: string) {
    return this.base.findOne(user.entId, inqId);
  }

  @Patch(':inqId')
  update(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: UpdateInquiryDto,
  ) {
    return this.base.update(user.entId, inqId, dto);
  }

  @Put(':inqId')
  legacyUpdate(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: UpdateInquiryDto,
  ) {
    return this.base.update(user.entId, inqId, dto);
  }

  @Delete(':inqId')
  @HttpCode(204)
  remove(@CurrentUser() user: AcmCurrentUser, @Param('inqId', ParseUUIDPipe) inqId: string) {
    return this.base.softDelete(user.entId, inqId);
  }

  @Post(':inqId/restore')
  @HttpCode(204)
  restore(@CurrentUser() user: AcmCurrentUser, @Param('inqId', ParseUUIDPipe) inqId: string) {
    return this.workflow.restore(user.entId, inqId);
  }

  @Post(':inqId/reveal-phone')
  revealPhone(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.workflow.revealPhone(user.entId, inqId, user.id, ip, userAgent);
  }

  @Post(':inqId/assign')
  assign(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: AssignDto,
  ) {
    return this.workflow.assign(user.entId, inqId, dto, user.id);
  }

  // ── Stage Pipeline ──────────────────────────────────────────────────
  @Get(':inqId/transitions')
  listTransitions(@CurrentUser() user: AcmCurrentUser, @Param('inqId', ParseUUIDPipe) inqId: string) {
    return this.workflow.listTransitions(user.entId, inqId);
  }

  @Post(':inqId/transitions')
  @ApiOperation({ summary: 'Forward stage transition' })
  forward(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: ChangeStageDto,
  ) {
    return this.base.forwardStage(user.entId, inqId, dto.toStage, dto.reason, user.id);
  }

  @Post(':inqId/transitions/backward')
  @ApiOperation({ summary: 'Admin backward override' })
  backward(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: BackwardTransitionDto,
  ) {
    // FIX-260622: same root cause as upsertEnrollment — use the JWT `role`.
    const isAdmin = user.role === 'ADMIN' || user.role === 'APP_ADMIN';
    return this.workflow.backwardTransition(user.entId, inqId, dto, user.id, isAdmin);
  }

  @Post(':inqId/cancellations')
  @ApiOperation({ summary: 'Drop with reason' })
  cancel(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: CreateCancellationDto,
  ) {
    return this.workflow.cancel(user.entId, inqId, dto, user.id);
  }

  @Get(':inqId/cancellations')
  listCancellations(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
  ) {
    return this.base.listCancellations(user.entId, inqId);
  }

  @Post(':inqId/reactivate')
  reactivate(@CurrentUser() user: AcmCurrentUser, @Param('inqId', ParseUUIDPipe) inqId: string) {
    return this.workflow.reactivate(user.entId, inqId, user.id);
  }

  // ── Sub-resources ───────────────────────────────────────────────────
  @Put(':inqId/map-test')
  @ApiOperation({ summary: 'Upsert MAP test record (CAL link auto-fired on schedule)' })
  async upsertMapTest(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: UpsertMapTestDto,
  ) {
    const saved = await this.base.upsertMapTest(user.entId, inqId, dto);
    // REQ-260626 T-08 / FR-CSL-114 — link to CAL after persistence. Best
    // effort; linker handles "already linked" / "schedule incomplete" /
    // "cal create failed" all the same way (returns null, no throw).
    const inq = await this.base.getOrThrow(user.entId, inqId);
    await this.calLinker.linkLevelTest(
      inq,
      saved,
      user.id,
      (user.role ?? 'STAFF') as AcmRole,
    );
    return saved;
  }

  @Get(':inqId/map-test')
  getMapTest(@CurrentUser() user: AcmCurrentUser, @Param('inqId', ParseUUIDPipe) inqId: string) {
    return this.base.getMapTest(user.entId, inqId);
  }

  /**
   * REQ-260626 FR-CSL-115 / Q-CSL-111 — admin/staff only.
   * Separated from upsertMapTest so the role gate can wrap result entry
   * without restricting the rest of the level-test surface (operator
   * schedules + intake fields are open to any authenticated staff).
   */
  @Post(':inqId/map-test/result')
  @ApiOperation({ summary: 'Record level test result (operator-only, FR-CSL-115)' })
  recordLevelTestResult(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: RecordLevelTestResultDto,
  ) {
    // STAFF↑ — TEACHER must NOT be able to enter or alter scores.
    const allowed = user.role === 'STAFF'
      || user.role === 'ADMIN'
      || user.role === 'APP_ADMIN';
    if (!allowed) {
      throw new ForbiddenException(
        'POL-CSL-201: only STAFF/ADMIN can record level-test results',
      );
    }
    return this.base.recordLevelTestResult(user.entId, inqId, dto, user.id);
  }

  /**
   * REQ-260626 FR-CSL-116 / DSN §5.7 — server-rendered level-test PDF.
   * STAFF↑ only (mirrors result-entry gate). Response is a binary PDF
   * stream with Content-Disposition: attachment so the browser triggers
   * a download instead of inline render. NFR-CSL-104 audit logging is
   * stubbed inline (the formal audit table comes with T-20).
   */
  @Get(':inqId/map-test/result-pdf')
  @ApiOperation({ summary: 'Download level test result PDF (FR-CSL-116, legacy 1:1)' })
  async downloadResultPdf(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Res() res: Response,
  ): Promise<void> {
    const allowed =
      !!user.role && ['TEACHER', 'STAFF', 'ADMIN', 'APP_ADMIN'].includes(user.role);
    if (!allowed) {
      throw new ForbiddenException('POL-CSL-204: only TEACHER/STAFF/ADMIN may download');
    }
    const { buffer, filename } = await this.pdf.generate(user.entId, inqId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.end(buffer);
  }

  // ── DSN-260629 §6 — per-test-type level-test routes ──────────────────

  /**
   * List every level-test row for an inquiry (one per applied exam type).
   * Returns [] when none yet scheduled. Frontend renders the schedule
   * table on top of this.
   */
  @Get(':inqId/level-tests')
  @ApiOperation({ summary: 'List per-exam-type level tests (DSN-260629 §6)' })
  listLevelTests(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
  ) {
    return this.base.listLevelTests(user.entId, inqId);
  }

  /**
   * Upsert one level-test row (1:N by exam type). Body = schedule fields
   * only — scoring is a separate endpoint with the admin gate. After
   * persistence, fires the CAL linker if scheduledAt + scheduledTime
   * are present.
   */
  @Put(':inqId/level-tests/:testType')
  @ApiOperation({ summary: 'Upsert per-type schedule + teacher + status' })
  async upsertLevelTest(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Param('testType') testType: string,
    @Body() dto: UpsertLevelTestDto,
  ) {
    const saved = await this.base.upsertLevelTest(
      user.entId,
      inqId,
      testType as 'MAP' | 'ISEE' | 'SSAT' | 'DUOLINGO' | 'TOEFL' | 'TOEFL_JR' | 'OTHER',
      dto,
    );
    // Best-effort CAL link (same pattern as upsertMapTest).
    if (saved.scheduledAt && saved.scheduledTime) {
      const inq = await this.base.getOrThrow(user.entId, inqId);
      await this.calLinker.linkLevelTest(
        inq,
        saved,
        user.id,
        (user.role ?? 'STAFF') as AcmRole,
      );
    }
    return saved;
  }

  /**
   * DSN-260629 §6 — per-type result entry. Same admin gate as the legacy
   * `/map-test/result` route.
   */
  @Post(':inqId/level-tests/:testType/result')
  @ApiOperation({ summary: 'Record per-type result (STAFF↑)' })
  recordLevelTestResultByType(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Param('testType') testType: string,
    @Body() dto: RecordLevelTestResultDto,
  ) {
    const allowed =
      !!user.role && ['STAFF', 'ADMIN', 'APP_ADMIN'].includes(user.role);
    if (!allowed) {
      throw new ForbiddenException(
        'POL-CSL-201: only STAFF/ADMIN can record level-test results',
      );
    }
    // dto carries scoreReading/Math/Language/scoreDetail; we re-route by the
    // URL-bound testType so a stale dto.testType can't poison the wrong row.
    return this.base.recordLevelTestResultByType(
      user.entId,
      inqId,
      testType as 'MAP' | 'ISEE' | 'SSAT' | 'DUOLINGO' | 'TOEFL' | 'TOEFL_JR' | 'OTHER',
      dto,
      user.id,
    );
  }

  @Get(':inqId/level-tests/:testType/result-pdf')
  @ApiOperation({ summary: 'Download per-type result PDF (DSN-260629 §6.5)' })
  async downloadResultPdfByType(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Param('testType') testType: string,
    @Res() res: Response,
  ): Promise<void> {
    const allowed =
      !!user.role && ['TEACHER', 'STAFF', 'ADMIN', 'APP_ADMIN'].includes(user.role);
    if (!allowed) {
      throw new ForbiddenException('POL-CSL-204: only TEACHER/STAFF/ADMIN may download');
    }
    const { buffer, filename } = await this.pdf.generate(
      user.entId,
      inqId,
      testType as 'MAP' | 'ISEE' | 'SSAT' | 'DUOLINGO' | 'TOEFL' | 'TOEFL_JR' | 'OTHER',
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.end(buffer);
  }

  /**
   * DSN-260629 §6.5 — unified PDF: one page per COMPLETED level-test row.
   * Operator-friendly single-file download instead of N per-type PDFs.
   */
  @Get(':inqId/level-tests/result-pdf')
  @ApiOperation({ summary: 'Download unified PDF (all completed level tests)' })
  async downloadUnifiedResultPdf(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Res() res: Response,
  ): Promise<void> {
    const allowed =
      !!user.role && ['TEACHER', 'STAFF', 'ADMIN', 'APP_ADMIN'].includes(user.role);
    if (!allowed) {
      throw new ForbiddenException('POL-CSL-204: only TEACHER/STAFF/ADMIN may download');
    }
    const { buffer, filename } = await this.pdf.generateUnified(user.entId, inqId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.end(buffer);
  }

  @Post(':inqId/trial-classes')
  async addTrialClass(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: CreateTrialClassDto,
  ) {
    const saved = await this.base.addTrialClass(user.entId, inqId, dto);
    if (saved.heldAt && saved.heldTime) {
      const inq = await this.base.getOrThrow(user.entId, inqId);
      await this.calLinker.linkDemoClass(
        inq,
        saved,
        user.id,
        (user.role ?? 'STAFF') as AcmRole,
      );
    }
    return saved;
  }

  @Get(':inqId/trial-classes')
  listTrialClasses(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
  ) {
    return this.base.listTrialClasses(user.entId, inqId);
  }

  // ── REQ-260626 — Demo class update + feedback workflow ──────────────

  @Patch(':inqId/trial-classes/:tclId')
  @ApiOperation({ summary: 'Update demo class (FR-CSL-122~125)' })
  async updateTrialClass(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Param('tclId', ParseUUIDPipe) tclId: string,
    @Body() dto: UpdateTrialClassDto,
  ) {
    const saved = await this.base.updateTrialClass(user.entId, inqId, tclId, dto);
    // REQ-260626 T-08 — late-bound schedule. CAL link is idempotent: if
    // calEventId is already set, the linker no-ops. So this is safe to
    // call on every patch.
    if (saved.heldAt && saved.heldTime) {
      const inq = await this.base.getOrThrow(user.entId, inqId);
      await this.calLinker.linkDemoClass(
        inq,
        saved,
        user.id,
        (user.role ?? 'STAFF') as AcmRole,
      );
    }
    return saved;
  }

  /**
   * REQ-260626 FR-CSL-127 — TEACHER writes the feedback after the demo.
   * STAFF/ADMIN can also edit (operator correction path). The completion
   * flag is set as a side-effect by the service (session implied held).
   */
  @Patch(':inqId/trial-classes/:tclId/feedback')
  @ApiOperation({ summary: 'Teacher writes demo feedback (FR-CSL-127)' })
  writeFeedback(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Param('tclId', ParseUUIDPipe) tclId: string,
    @Body() dto: WriteFeedbackDto,
  ) {
    const allowed = !!user.role && ['TEACHER', 'STAFF', 'ADMIN', 'APP_ADMIN'].includes(user.role);
    if (!allowed) {
      throw new ForbiddenException('Only TEACHER/STAFF/ADMIN may write demo feedback');
    }
    return this.base.writeFeedback(user.entId, inqId, tclId, dto.body, user.id);
  }

  /**
   * REQ-260626 FR-CSL-128 — operator confirms the feedback before parent
   * delivery. ADMIN/STAFF only. Requires feedback body to be set (the
   * service raises 400 otherwise).
   */
  @Post(':inqId/trial-classes/:tclId/feedback/confirm')
  @ApiOperation({ summary: 'Operator confirms demo feedback (FR-CSL-128)' })
  confirmFeedback(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Param('tclId', ParseUUIDPipe) tclId: string,
  ) {
    const allowed = !!user.role && ['STAFF', 'ADMIN', 'APP_ADMIN'].includes(user.role);
    if (!allowed) {
      throw new ForbiddenException('Only STAFF/ADMIN may confirm demo feedback');
    }
    return this.base.confirmFeedback(user.entId, inqId, tclId, user.id);
  }

  /**
   * REQ-260626 FR-CSL-128 — operator marks feedback as delivered after
   * manually pasting into KakaoTalk (auto delivery is out-of-scope, see
   * Q-CSL-108). Requires the confirm step to have happened.
   */
  @Post(':inqId/trial-classes/:tclId/feedback/delivered')
  @ApiOperation({ summary: 'Mark feedback delivered to parent (FR-CSL-128)' })
  markFeedbackDelivered(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Param('tclId', ParseUUIDPipe) tclId: string,
  ) {
    const allowed = !!user.role && ['STAFF', 'ADMIN', 'APP_ADMIN'].includes(user.role);
    if (!allowed) {
      throw new ForbiddenException('Only STAFF/ADMIN may mark delivery');
    }
    return this.base.markFeedbackDelivered(user.entId, inqId, tclId);
  }

  @Put(':inqId/enrollment')
  upsertEnrollment(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: UpsertEnrollmentDto,
  ) {
    // FIX-260622: derive from the JWT `role` (singular, uppercase). The legacy
    // `user.roles` array is never populated and used lowercase values, so this
    // was always false → BR-CSL-012 blocked every tuitionPaid change with 403.
    const isSeniorManager = user.role === 'ADMIN' || user.role === 'APP_ADMIN';
    return this.base.upsertEnrollment(user.entId, inqId, dto, {
      id: user.id,
      isSeniorManager,
    });
  }

  @Get(':inqId/enrollment')
  getEnrollment(@CurrentUser() user: AcmCurrentUser, @Param('inqId', ParseUUIDPipe) inqId: string) {
    return this.base.getEnrollment(user.entId, inqId);
  }

  /**
   * REQ-260626 FR-CSL-141/142 — explicit payment approval (ADMIN/APP_ADMIN).
   * Distinct from PUT /enrollment so the role gate is on a single audit
   * surface. Idempotent — already-approved returns the current row.
   */
  @Post(':inqId/enrollment/approve-payment')
  @ApiOperation({ summary: 'Approve payment — ADMIN/APP_ADMIN only (FR-CSL-141)' })
  approvePayment(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: ApprovePaymentDto,
  ) {
    const isSeniorManager = user.role === 'ADMIN' || user.role === 'APP_ADMIN';
    return this.base.approvePayment(user.entId, inqId, dto.method, dto.memo, {
      id: user.id,
      isSeniorManager,
    });
  }

  // ── REQ-260626 FR-CSL-136 — Multi-teacher assignment ────────────────
  @Get(':inqId/teacher-assignments')
  @ApiOperation({ summary: 'List assigned teachers (FR-CSL-136)' })
  listTeacherAssignments(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
  ) {
    return this.teachers.list(user.entId, inqId);
  }

  @Post(':inqId/teacher-assignments')
  @ApiOperation({ summary: 'Assign teacher (PRIMARY/SECONDARY) — upsert by (inq,tch)' })
  assignTeacher(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: AssignTeacherDto,
  ) {
    return this.teachers.assign({
      entId: user.entId,
      inqId,
      teacherId: dto.teacherId,
      role: dto.role ?? 'PRIMARY',
      actorId: user.id,
    });
  }

  @Delete(':inqId/teacher-assignments/:asgId')
  @ApiOperation({ summary: 'Remove a teacher assignment by row id' })
  removeTeacherAssignment(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Param('asgId', ParseUUIDPipe) asgId: string,
  ) {
    return this.teachers.remove(user.entId, inqId, asgId);
  }

  // ── Remarks ─────────────────────────────────────────────────────────
  @Post(':inqId/remarks')
  addRemark(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: CreateRemarkDto,
  ) {
    return this.workflow.addRemark(user.entId, inqId, dto, user.id);
  }

  @Get(':inqId/remarks')
  listRemarks(@CurrentUser() user: AcmCurrentUser, @Param('inqId', ParseUUIDPipe) inqId: string) {
    return this.workflow.listRemarks(user.entId, inqId);
  }

  // ── REQ-260626 T-06 / ADR-008 — Attachments (backend-proxied to MinIO) ──
  // FIX-260630: presigned PUT/GET removed because MinIO's docker-internal
  // endpoint (`http://minio:9000`) is unreachable from the browser over
  // HTTPS Mixed Content. Backend now proxies the upload + download stream.

  @Post(':inqId/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload attachment (multipart) — backend proxies to MinIO' })
  async uploadAttachment(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category?: string,
    @Body('refId') refId?: string,
  ) {
    const role = user.role as AcmRole | undefined;
    const isStaffPlus = !!role && ['STAFF', 'ADMIN', 'APP_ADMIN'].includes(role);
    const isTeacherPlus = !!role && ['TEACHER', 'STAFF', 'ADMIN', 'APP_ADMIN'].includes(role);
    if (!category || !['TRANSCRIPT', 'MATERIAL', 'RESULT_PDF'].includes(category)) {
      throw new BadRequestException({ code: 'CATEGORY_REQUIRED' });
    }
    if (category === 'TRANSCRIPT' && !isStaffPlus) {
      throw new ForbiddenException({ code: 'ROLE_REQUIRED_STAFF_PLUS' });
    }
    if (category === 'MATERIAL' && !isTeacherPlus) {
      throw new ForbiddenException({ code: 'ROLE_REQUIRED_TEACHER_PLUS' });
    }
    return this.attachments.upload(
      user.entId,
      inqId,
      file,
      { category: category as 'TRANSCRIPT' | 'MATERIAL' | 'RESULT_PDF', refId },
      user.id,
    );
  }

  @Get(':inqId/attachments')
  @ApiOperation({ summary: 'List attachments (filtered by role visibility)' })
  async listAttachments(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Query('category') category?: 'TRANSCRIPT' | 'MATERIAL' | 'RESULT_PDF',
  ) {
    const rows = await this.attachments.list(user.entId, inqId, category);
    const role = (user.role as AcmRole | undefined) ?? 'STAFF';
    return rows.filter((r) => AttachmentService.canView(r, role));
  }

  @Get(':inqId/attachments/:attId/download')
  @ApiOperation({ summary: 'Stream attachment bytes (backend-proxied from MinIO)' })
  async downloadAttachment(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Param('attId', ParseUUIDPipe) attId: string,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ): Promise<StreamableFile> {
    const rows = await this.attachments.list(user.entId, inqId);
    const row = rows.find((r) => r.id === attId);
    const role = (user.role as AcmRole | undefined) ?? 'STAFF';
    if (!row || !AttachmentService.canView(row, role)) {
      throw new ForbiddenException({ code: 'ATTACHMENT_FORBIDDEN' });
    }
    // NFR-CSL-104 / T-20 v2.1 — audit (best-effort, swallowed in service).
    await this.attachments.recordDownloadAudit(row, user.id, ip, userAgent);

    const { stream, filename, mime, sizeBytes } =
      await this.attachments.streamDownload(user.entId, inqId, attId);
    const encoded = encodeURIComponent(filename);
    res.set({
      'Content-Type': mime,
      'Content-Length': String(sizeBytes),
      'Content-Disposition': `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
    });
    return new StreamableFile(stream);
  }

  @Delete(':inqId/attachments/:attId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete (STAFF↑)' })
  async deleteAttachment(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Param('attId', ParseUUIDPipe) attId: string,
  ): Promise<void> {
    const role = user.role as AcmRole | undefined;
    const isStaffPlus = !!role && ['STAFF', 'ADMIN', 'APP_ADMIN'].includes(role);
    if (!isStaffPlus) {
      throw new ForbiddenException({ code: 'ROLE_REQUIRED_STAFF_PLUS' });
    }
    await this.attachments.softDelete(user.entId, inqId, attId);
  }
}
