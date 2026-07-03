import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { NotificationService } from '../application/notification.service';

@ApiTags('notification-logs')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard)
@Controller('notifications/logs')
export class NotificationLogController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List notification logs for admin review' })
  async list(
    @CurrentUser() user: AcmCurrentUser,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('status') status?: string,
    @Query('event') event?: string,
  ) {
    const page = Math.max(1, Number(pageRaw ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitRaw ?? 20) || 20));
    const { items, total } = await this.notifications.list(user.entId, {
      page,
      limit,
      status,
      templateCode: event,
    });
    return {
      data: items.map((row) => ({
        id: row.id,
        event: row.templateCode ?? row.subject ?? 'SYSTEM',
        status: row.status,
        channel: row.channel,
        recipient: row.toAddress ?? row.recipientId ?? '-',
        recipientKind: row.recipientKind ?? 'UNKNOWN',
        subjectId: row.recipientId ?? null,
        subjectKind: row.recipientKind ?? null,
        sentAt: row.sentAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        errorCode: row.error ? 'DELIVERY_ERROR' : null,
        errorMessage: row.error ?? null,
        attempts: 1,
      })),
      meta: { page, limit, total },
    };
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Move a failed/skipped notification back to pending' })
  async resend(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const row = await this.notifications.resend(user.entId, id);
    return {
      id: row.id,
      status: row.status,
    };
  }
}
