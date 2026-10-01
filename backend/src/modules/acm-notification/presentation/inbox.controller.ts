import {
  Body,
  Controller,
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
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { InboxService } from '../application/inbox.service';
class ReadAllDto {
  @IsISO8601() asOf!: string;
}
@Controller('acm/notifications/inbox')
@UseGuards(AcmJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF', 'APP_ADMIN', 'TEACHER')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}
  @Get() list(
    @CurrentUser() u: AcmCurrentUser,
    @Query('cursor') cursor?: string,
    @Query('unread') unread?: string,
  ) {
    return this.inbox.list(u, cursor, unread === 'true');
  }
  @Get('count') count(@CurrentUser() u: AcmCurrentUser) {
    return this.inbox.count(u);
  }
  @Sse('events')
  @Header('X-Accel-Buffering', 'no')
  @Header('Cache-Control', 'no-cache')
  events(@CurrentUser() u: AcmCurrentUser) {
    return this.inbox.events(u);
  }
  @Patch(':id/read') read(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inbox.read(u, id);
  }
  @Post('read-all') readAll(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: ReadAllDto,
  ) {
    return this.inbox.readAll(u, dto.asOf);
  }
}
