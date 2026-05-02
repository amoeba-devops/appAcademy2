import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { ConfirmSettlementDto, SettlementQueryDto } from '../application/dto/session.dto';
import { SettlementService } from '../application/settlement.service';

@ApiTags('acm-cls')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/cls/settlements')
export class SettlementController {
  constructor(private readonly service: SettlementService) {}

  @Get()
  @ApiOperation({ summary: 'List settlements for a year-month (UI-CLS-005)' })
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: SettlementQueryDto) {
    return this.service.list(u.entId, q.yearMonth, q.teacherUserId);
  }

  @Get(':id')
  findOne(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(u.entId, id);
  }

  @Post('recompute')
  @ApiOperation({ summary: 'Recompute month settlements (manual trigger)' })
  recompute(
    @CurrentUser() u: AcmCurrentUser,
    @Body() body: { yearMonth: string; teacherUserId?: string },
  ) {
    if (body.teacherUserId) {
      return this.service.recomputeOne(u.entId, body.teacherUserId, body.yearMonth);
    }
    return this.service.recomputeMonth(u.entId, body.yearMonth);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm settlement (BR-CLS-010 manual path)' })
  confirm(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmSettlementDto,
  ) {
    return this.service.confirm(u.entId, id, dto, u.id);
  }
}
