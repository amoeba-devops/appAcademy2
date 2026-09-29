import {
  ForbiddenException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { LifecycleService } from '../application/lifecycle.service';
import { LifecycleDto } from '../application/dto/lifecycle.dto';
@Controller('acm/dsh/lifecycle')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN', 'STAFF')
export class LifecycleController {
  constructor(private readonly service: LifecycleService) {}
  @Get('subjects') subjects(
    @CurrentUser() u: AcmCurrentUser,
    @Query('kind') kind: string,
    @Query('q') q?: string,
  ) {
    return this.service.subjects(u.entId, kind, q);
  }
  @Get('range') range(
    @CurrentUser() u: AcmCurrentUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('site') site?: string,
  ) {
    return this.service.range(u.entId, from, to, site);
  }
  @Get('details') details(
    @CurrentUser() u: AcmCurrentUser,
    @Query('date') date: string,
    @Query('code') code: string,
    @Query('site') site?: string,
  ) {
    return this.service.details(u.entId, date, code, site);
  }
  @Get('records/:kind/:id') list(
    @CurrentUser() u: AcmCurrentUser,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.list(u.entId, kind, id);
  }
  @Post('records') save(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: LifecycleDto,
  ) {
    if (
      ['FIRST_PAYMENT', 'FIRST_CLASS', 'PAYMENT_ENDED'].includes(dto.kind) &&
      u.role !== 'ADMIN'
    )
      throw new ForbiddenException('Administrator confirmation required');
    return this.service.record(u.entId, u.id, dto);
  }
  @Delete('records/:id') cancel(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(u.entId, id, u.id, u.role);
  }
}
