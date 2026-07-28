import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { CalEventService } from '../application/cal-event.service';
import { BodaRecordService } from '../application/boda-record.service';
import { CalEventReviewService } from '../application/cal-event-review.service';
import {
  CreateCalEventDto,
  DeleteCalEventDto,
  ListCalEventsQueryDto,
  UpdateCalEventDto,
} from '../application/dto/cal-event.dto';

@ApiTags('acm-cal')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/cal/events')
export class CalEventController {
  constructor(
    private readonly svc: CalEventService,
    private readonly recordSvc: BodaRecordService,
    private readonly reviewSvc: CalEventReviewService,
  ) {}

  @Get(':id/review')
  @ApiOperation({ summary: '수업 피드백·과제 조회 — 관리자 확인용 (PLN-260728F B)' })
  review(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviewSvc.get(u.entId, id);
  }

  @Get(':id/class-record')
  @ApiOperation({
    summary: '보다 강의실 실적 기록 — 개설/시작/종료 시각 + 참석자 입·퇴실 (PLN-260728F)',
  })
  classRecord(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recordSvc.getClassRecord(u.entId, id, { scope: 'ALL' });
  }

  @Get()
  @ApiOperation({ summary: 'List calendar events in range (FR-CAL-001)' })
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: ListCalEventsQueryDto) {
    return this.svc.list(u.entId, u.id, u.role ?? 'ADMIN', q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event detail (FR-CAL-002)' })
  findOne(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(u.entId, u.id, u.role ?? 'ADMIN', id);
  }

  @Post()
  @ApiOperation({ summary: 'Create event (FR-CAL-003)' })
  create(@CurrentUser() u: AcmCurrentUser, @Body() dto: CreateCalEventDto) {
    return this.svc.create(u.entId, u.id, u.role ?? 'ADMIN', dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update event (FR-CAL-004)' })
  update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalEventDto,
  ) {
    return this.svc.update(u.entId, u.id, u.role ?? 'ADMIN', id, dto);
  }

  @Get(':id/revisions')
  @ApiOperation({ summary: '수정 히스토리 조회 (REQ-260728)' })
  revisions(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getRevisions(u.entId, u.id, u.role ?? 'ADMIN', id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete event — 삭제 사유 필수 (FR-CAL-005 / REQ-260728)' })
  remove(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteCalEventDto,
  ) {
    return this.svc.remove(u.entId, u.id, u.role ?? 'ADMIN', id, dto.reason);
  }
}
