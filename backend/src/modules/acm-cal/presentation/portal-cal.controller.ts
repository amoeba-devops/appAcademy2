import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
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
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { CalEventService } from '../application/cal-event.service';
import { CalEventAttachmentService } from '../application/cal-event-attachment.service';
import { BodaRecordService } from '../application/boda-record.service';
import {
  CalEventReviewService,
} from '../application/cal-event-review.service';
import type { CalHomeworkStatus } from '../infrastructure/typeorm/cal-event-review.typeorm-entity';
import { ListCalEventsQueryDto } from '../application/dto/cal-event.dto';

/**
 * PLN-260706 §4.4 — read-only calendar for portal users (student/parent/teacher).
 * Returns ONLY the events the caller is related to (see CalEventService.listForPortal).
 */
@ApiTags('portal-cal')
@ApiBearerAuth()
@UseGuards(PortalJwtAuthGuard)
@Controller('portal/cal/events')
export class PortalCalController {
  constructor(
    private readonly svc: CalEventService,
    private readonly attachmentSvc: CalEventAttachmentService,
    private readonly recordSvc: BodaRecordService,
    private readonly reviewSvc: CalEventReviewService,
  ) {}

  // ── 피드백·과제 (PLN-260728F B) ─────────────────────────────────────

  @Get(':id/review')
  @ApiOperation({ summary: '수업 피드백·과제 조회 (관련자 열람)' })
  async getReview(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.svc.ensurePortalEventAccess(u.entId, u.kind, u.refId, id);
    return this.reviewSvc.get(u.entId, id);
  }

  @Put(':id/review')
  @ApiOperation({ summary: '수업 피드백·과제 작성/수정 (담당강사만)' })
  async putReview(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      feedbackHtml?: string;
      homeworkStatus?: CalHomeworkStatus;
      homeworkHtml?: string;
    },
  ) {
    if (u.kind !== 'TEACHER') throw new ForbiddenException('TEACHER_ONLY');
    await this.svc.ensurePortalEventAccess(u.entId, u.kind, u.refId, id);
    const meta = await this.svc.getEventMeta(u.entId, id);
    this.reviewSvc.assertAssignee(meta.assigneeTchId, u.refId);
    return this.reviewSvc.upsert(u.entId, id, u.refId, body);
  }

  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '과제 파일 업로드 (담당강사만, kind=HOMEWORK)' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadHomework(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (u.kind !== 'TEACHER') throw new ForbiddenException('TEACHER_ONLY');
    await this.svc.ensurePortalEventAccess(u.entId, u.kind, u.refId, id);
    const meta = await this.svc.getEventMeta(u.entId, id);
    this.reviewSvc.assertAssignee(meta.assigneeTchId, u.refId);
    return this.attachmentSvc.upload(u.entId, id, file, u.refId, 'HOMEWORK');
  }

  @Delete(':id/attachments/:attId')
  @ApiOperation({ summary: '과제 파일 삭제 (담당강사만)' })
  async deleteHomework(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attId', ParseUUIDPipe) attId: string,
  ) {
    if (u.kind !== 'TEACHER') throw new ForbiddenException('TEACHER_ONLY');
    await this.svc.ensurePortalEventAccess(u.entId, u.kind, u.refId, id);
    const meta = await this.svc.getEventMeta(u.entId, id);
    this.reviewSvc.assertAssignee(meta.assigneeTchId, u.refId);
    return this.attachmentSvc.softDelete(u.entId, id, attId);
  }

  @Get(':id/class-record')
  @ApiOperation({
    summary:
      '강의실 실적 기록 — 강사=전체 참석자, 학생=본인, 학부모=자녀 (PLN-260728F)',
  })
  async classRecord(@PortalUser() u: PortalAuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.svc.ensurePortalEventAccess(u.entId, u.kind, u.refId, id);
    const viewer =
      u.kind === 'TEACHER'
        ? ({ scope: 'ALL' } as const)
        : u.kind === 'PARENT'
          ? ({ scope: 'PARENT', refId: u.refId } as const)
          : ({ scope: 'STUDENT', refId: u.refId } as const);
    return this.recordSvc.getClassRecord(u.entId, id, viewer);
  }

  @Get()
  @ApiOperation({
    summary: 'List my related calendar events (month/week/day range)',
  })
  list(@PortalUser() u: PortalAuthUser, @Query() q: ListCalEventsQueryDto) {
    return this.svc.listForPortal(u.entId, u.kind, u.refId, q);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Single related calendar event detail (PLN-260715)',
  })
  detail(@PortalUser() u: PortalAuthUser, @Param('id') id: string) {
    return this.svc.getForPortal(u.entId, u.kind, u.refId, id);
  }

  @Get(':id/attachments/:attId/download')
  @ApiOperation({
    summary: 'Download an attachment of a related event (PLN-260718 P2)',
  })
  async download(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) evtId: string,
    @Param('attId', ParseUUIDPipe) attId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.svc.ensurePortalEventAccess(u.entId, u.kind, u.refId, evtId);
    const { stream, mime, filename } = await this.attachmentSvc.streamDownload(
      u.entId,
      evtId,
      attId,
    );
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(stream);
  }
}
