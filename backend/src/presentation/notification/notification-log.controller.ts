import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { NotificationLogEntity } from '../../infrastructure/database/entities/notification-log.entity';
import { NotificationDispatcher } from './notification-dispatcher.service';
import {
  EVENT_TO_NTF_EVENT,
  NOTIFICATION_EVENTS,
  type NotificationEventName,
} from '../../application/notification/notification-context.types';

@ApiTags('Notification Logs')
@Controller('notifications/logs')
export class NotificationLogController {
  constructor(
    @InjectRepository(NotificationLogEntity)
    private readonly repo: Repository<NotificationLogEntity>,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notification delivery logs' })
  async list(
    @Query('event') event?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Math.max(1, Number(pageRaw ?? 1));
    const limit = Math.min(100, Math.max(1, Number(limitRaw ?? 20)));

    const where: FindOptionsWhere<NotificationLogEntity> = {};
    if (event) where.nlgEvent = event;
    if (status) where.nlgStatus = status as NotificationLogEntity['nlgStatus'];
    if (from && to) where.nlgCreatedAt = Between(new Date(from), new Date(to));
    else if (from) where.nlgCreatedAt = MoreThanOrEqual(new Date(from));
    else if (to) where.nlgCreatedAt = LessThanOrEqual(new Date(to));

    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { nlgCreatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: rows.map((r) => this.toDto(r)),
      meta: { page, limit, total },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification log by id (full body + variables)' })
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const row = await this.repo.findOne({ where: { nlgId: id } });
    if (!row) throw new NotFoundException('Notification log not found');
    return { data: this.toDto(row, /* full */ true) };
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Resend a previously failed (or any) notification' })
  async resend(@Param('id', ParseIntPipe) id: number) {
    const row = await this.repo.findOne({ where: { nlgId: id } });
    if (!row) throw new NotFoundException('Notification log not found');
    if (row.nlgStatus === 'SENT') {
      throw new ConflictException(
        'Already SENT. Resending an already-sent notification is not allowed.',
      );
    }

    const eventName = ntfEventToEventName(row.nlgEvent);
    if (!eventName) {
      throw new ConflictException(`Unsupported event: ${row.nlgEvent}`);
    }
    await this.dispatcher.dispatch(eventName, {
      academyId: row.acdId,
      recipients: [row.nlgRecipient],
      recipientKind: row.nlgRecipientKind as 'PARENT' | 'STUDENT' | 'STAFF',
      subjectId: row.nlgSubjectId ?? undefined,
      subjectKind: row.nlgSubjectKind ?? undefined,
      variables: (row.nlgVariables ?? {}) as Record<string, string>,
    });
    return { data: { ok: true, original_log_id: id } };
  }

  private toDto(r: NotificationLogEntity, full = false) {
    return {
      id: r.nlgId,
      academyId: r.acdId,
      event: r.nlgEvent,
      templateId: r.nlgTemplateId,
      channel: r.nlgChannel,
      recipient: maskPhone(r.nlgRecipient),
      recipientKind: r.nlgRecipientKind,
      subjectId: r.nlgSubjectId,
      subjectKind: r.nlgSubjectKind,
      status: r.nlgStatus,
      providerMsgId: r.nlgProviderMsgId,
      errorCode: r.nlgErrorCode,
      errorMessage: r.nlgErrorMessage,
      attempts: r.nlgAttempts,
      sentAt: r.nlgSentAt,
      createdAt: r.nlgCreatedAt,
      ...(full ? { body: r.nlgBody, variables: r.nlgVariables } : {}),
    };
  }
}

function ntfEventToEventName(nlgEvent: string): NotificationEventName | null {
  for (const [evt, ntf] of Object.entries(EVENT_TO_NTF_EVENT)) {
    if (ntf === nlgEvent) return evt as NotificationEventName;
  }
  // fall through: try direct match against canonical names
  return Object.values(NOTIFICATION_EVENTS).includes(
    nlgEvent as NotificationEventName,
  )
    ? (nlgEvent as NotificationEventName)
    : null;
}

function maskPhone(p: string): string {
  if (!p) return '';
  return p.replace(/\d(?=\d{4})/g, '*');
}
