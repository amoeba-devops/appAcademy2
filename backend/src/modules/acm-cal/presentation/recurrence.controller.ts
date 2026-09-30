import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { RecurrenceService } from '../application/recurrence.service';
import {
  ChangeRecurrenceDto,
  CreateRecurrenceDto,
  RecurrencePreviewDto,
} from '../application/dto/recurrence.dto';
@Controller('acm/cal/recurrence')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN', 'STAFF', 'TEACHER')
export class RecurrenceController {
  constructor(private readonly svc: RecurrenceService) {}
  @Get('status') status(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.generationStatus(u);
  }
  @Post('preview') preview(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: RecurrencePreviewDto,
  ) {
    return this.svc.preview(u.entId, dto);
  }
  @Post('series') create(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: CreateRecurrenceDto,
  ) {
    return this.svc.create(u, dto);
  }
  @Get('events/:id') metadata(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.metadata(u, id);
  }
  @Post('events/:id/impact') impact(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRecurrenceDto,
  ) {
    return this.svc.change(u, id, dto, false, true);
  }
  @Post('events/:id/update') update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRecurrenceDto,
  ) {
    return this.svc.change(u, id, dto);
  }
  @Post('events/:id/delete') remove(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRecurrenceDto,
  ) {
    return this.svc.change(u, id, dto, true);
  }
}
