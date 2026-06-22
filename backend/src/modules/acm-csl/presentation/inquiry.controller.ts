import {
  Body,
  Controller,
  Delete,
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { InquiryService } from '../application/inquiry.service';
import { InquiryWorkflowService } from '../application/inquiry-workflow.service';
import {
  ChangeStageDto,
  CreateCancellationDto,
  CreateInquiryDto,
  CreateTrialClassDto,
  UpdateInquiryDto,
  UpsertEnrollmentDto,
  UpsertMapTestDto,
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
  @ApiOperation({ summary: 'Upsert MAP test record' })
  upsertMapTest(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: UpsertMapTestDto,
  ) {
    return this.base.upsertMapTest(user.entId, inqId, dto);
  }

  @Get(':inqId/map-test')
  getMapTest(@CurrentUser() user: AcmCurrentUser, @Param('inqId', ParseUUIDPipe) inqId: string) {
    return this.base.getMapTest(user.entId, inqId);
  }

  @Post(':inqId/trial-classes')
  addTrialClass(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
    @Body() dto: CreateTrialClassDto,
  ) {
    return this.base.addTrialClass(user.entId, inqId, dto);
  }

  @Get(':inqId/trial-classes')
  listTrialClasses(
    @CurrentUser() user: AcmCurrentUser,
    @Param('inqId', ParseUUIDPipe) inqId: string,
  ) {
    return this.base.listTrialClasses(user.entId, inqId);
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
}
