import { Controller, Header, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { AdminEventsSseService } from '../application/admin-events-sse.service';

/**
 * REQ-260903C — 콘솔 전 역할(ADMIN/STAFF/TEACHER 콘솔 계정) 실시간 알림 스트림.
 * 신규상담 접수 등 테넌트 브로드캐스트 이벤트 + heartbeat.
 */
@ApiTags('acm-notification')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard)
@Controller('acm/notifications')
export class AdminEventsController {
  constructor(private readonly sse: AdminEventsSseService) {}

  @Sse('events')
  @Header('X-Accel-Buffering', 'no')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({ summary: 'Console realtime events SSE (tenant broadcast)' })
  events(@CurrentUser() u: AcmCurrentUser): Observable<{ data: string }> {
    return this.sse.subscribe(u.entId);
  }
}
