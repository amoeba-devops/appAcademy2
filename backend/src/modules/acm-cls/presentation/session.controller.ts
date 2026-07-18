import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { AttendanceService } from '../application/attendance.service';
import {
  ApproveMakeupDto,
  CancelSessionDto,
  CreateSessionDto,
  HoldSessionDto,
  ListSessionsQueryDto,
  ProposeMakeupDto,
  RecordAttendanceDto,
  RescheduleSessionDto,
  UpsertFeedbackDto,
} from '../application/dto/session.dto';
import { FeedbackService } from '../application/feedback.service';
import { MakeupService } from '../application/makeup.service';
import { SessionService } from '../application/session.service';

@ApiTags('acm-cls')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/cls')
export class SessionController {
  constructor(
    private readonly sessions: SessionService,
    private readonly attendance: AttendanceService,
    private readonly feedback: FeedbackService,
    private readonly makeup: MakeupService,
  ) {}

  // ── Sessions ──
  @Post('sessions')
  @ApiOperation({
    summary: 'Create one-off session (BR-CLS-011/012 conflict-checked)',
  })
  createSession(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: CreateSessionDto,
  ) {
    return this.sessions.createOne(u.entId, dto, u.id);
  }

  @Get('sessions')
  listSessions(
    @CurrentUser() u: AcmCurrentUser,
    @Query() q: ListSessionsQueryDto,
  ) {
    return this.sessions.list(u.entId, q);
  }

  @Get('sessions/:id')
  findSession(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sessions.findOne(u.entId, id);
  }

  @Patch('sessions/:id/reschedule')
  reschedule(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleSessionDto,
  ) {
    return this.sessions.reschedule(u.entId, id, dto, u.id);
  }

  @Patch('sessions/:id/cancel')
  cancel(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSessionDto,
  ) {
    return this.sessions.cancel(u.entId, id, dto, u.id);
  }

  @Patch('sessions/:id/hold')
  hold(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HoldSessionDto,
  ) {
    return this.sessions.markHeld(u.entId, id, dto, u.id);
  }

  // ── Attendance ──
  @Get('sessions/:id/attendance')
  listAttendance(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attendance.listForSession(u.entId, id);
  }

  @Post('sessions/:id/attendance')
  recordAttendance(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordAttendanceDto,
  ) {
    return this.attendance.record(u.entId, id, dto, u.id);
  }

  // ── Feedback ──
  @Get('sessions/:id/feedback')
  listFeedback(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.feedback.listForSession(u.entId, id);
  }

  @Post('sessions/:id/feedback')
  upsertFeedback(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertFeedbackDto,
  ) {
    return this.feedback.upsert(u.entId, id, dto, u.id);
  }

  // ── Makeup ──
  @Get('makeups')
  listMakeups(
    @CurrentUser() u: AcmCurrentUser,
    @Query('status') status?: string,
  ) {
    return this.makeup.list(u.entId, status);
  }

  @Post('makeups')
  proposeMakeup(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: ProposeMakeupDto,
  ) {
    return this.makeup.propose(u.entId, dto, u.id);
  }

  @Patch('makeups/:id/decision')
  decideMakeup(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveMakeupDto,
  ) {
    return this.makeup.decide(u.entId, id, dto, u.id);
  }
}
