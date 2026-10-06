import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { AmaForwardService } from '../application/ama-forward.service';

/** REQ-261006 — AMA 알림 전달 현황·테스트 (ADMIN). */
@ApiTags('acm-ama-config')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN', 'APP_ADMIN')
@Controller('acm/admin/ama-config/forward')
export class AmaForwardController {
  constructor(private readonly svc: AmaForwardService) {}

  @Get('status')
  @ApiOperation({
    summary: 'AMA 알림 전달 현황 (최근 7일 상태별 건수·최근 20건)',
  })
  status(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.status(u.entId);
  }

  @Post('test')
  @ApiOperation({ summary: '현재 사용자에게 AMA 테스트 알림 전송' })
  test(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.sendTest(u.entId, u.id);
  }
}
