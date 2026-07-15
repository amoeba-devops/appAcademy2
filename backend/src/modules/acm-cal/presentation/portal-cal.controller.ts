import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { CalEventService } from '../application/cal-event.service';
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
  constructor(private readonly svc: CalEventService) {}

  @Get()
  @ApiOperation({ summary: 'List my related calendar events (month/week/day range)' })
  list(@PortalUser() u: PortalAuthUser, @Query() q: ListCalEventsQueryDto) {
    return this.svc.listForPortal(u.entId, u.kind, u.refId, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Single related calendar event detail (PLN-260715)' })
  detail(@PortalUser() u: PortalAuthUser, @Param('id') id: string) {
    return this.svc.getForPortal(u.entId, u.kind, u.refId, id);
  }
}
