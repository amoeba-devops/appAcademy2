import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { CalEventService } from '../application/cal-event.service';
import { CalEventAttachmentService } from '../application/cal-event-attachment.service';
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
  ) {}

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
