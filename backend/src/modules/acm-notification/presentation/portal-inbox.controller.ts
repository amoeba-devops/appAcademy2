import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { IsISO8601 } from 'class-validator';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { InboxService, type InboxActor } from '../application/inbox.service';
class ReadAllDto {
  @IsISO8601() asOf!: string;
}
@Controller('portal/notifications/inbox')
@UseGuards(PortalJwtAuthGuard)
export class PortalInboxController {
  constructor(private readonly inbox: InboxService) {}
  private actor(u: PortalAuthUser): InboxActor {
    if (u.kind !== 'TEACHER') throw new ForbiddenException('TEACHER_ONLY');
    return { entId: u.entId, id: u.refId, kind: 'TEACHER' };
  }
  @Get() list(
    @PortalUser() u: PortalAuthUser,
    @Query('cursor') cursor?: string,
    @Query('unread') unread?: string,
  ) {
    return this.inbox.list(this.actor(u), cursor, unread === 'true');
  }
  @Get('count') count(@PortalUser() u: PortalAuthUser) {
    return this.inbox.count(this.actor(u));
  }
  @Sse('events')
  @Header('X-Accel-Buffering', 'no')
  @Header('Cache-Control', 'no-cache')
  events(@PortalUser() u: PortalAuthUser) {
    return this.inbox.events(this.actor(u));
  }
  @Patch(':id/read') read(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inbox.read(this.actor(u), id);
  }
  @Post('read-all') readAll(
    @PortalUser() u: PortalAuthUser,
    @Body() dto: ReadAllDto,
  ) {
    return this.inbox.readAll(this.actor(u), dto.asOf);
  }
}
