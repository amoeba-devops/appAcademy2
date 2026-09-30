import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsDateString } from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { CalEventService } from '../application/cal-event.service';
import { IcsImportService } from '../application/ics/ics-import.service';
class StopIcsDto {
  @IsDateString() from!: string;
}
@Controller('acm/cal/events')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
export class IcsController {
  constructor(
    private readonly ics: IcsImportService,
    private readonly events: CalEventService,
  ) {}
  @Get(':id/ics')
  async metadata(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.events.findOne(user.entId, user.id, user.role ?? 'ADMIN', id);
    return this.ics.metadata(user.entId, id);
  }
  @Post(':id/ics/stop')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async stop(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: StopIcsDto,
  ) {
    await this.events.findOne(user.entId, user.id, user.role ?? 'ADMIN', id);
    return this.ics.stop(user.entId, id, user.id, body.from);
  }
}
