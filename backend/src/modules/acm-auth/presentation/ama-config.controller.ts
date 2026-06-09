import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { AcmJwtAuthGuard } from '../guards/acm-jwt-auth.guard';
import { AmaConfigService } from '../application/ama-config.service';
import {
  AmaConfigResponseDto,
  UpdateAmaConfigDto,
} from '../application/dto/ama-config.dto';

/**
 * REQ-260609B FR-2 — 어드민 AMA 연동 설정 (entityId · appCode).
 *
 * 저장된 값과 SSO 토큰 클레임이 일치할 때만 로그인이 허용된다(게이트는
 * AmaConfigGateService). ADMIN 역할만 접근.
 */
@ApiTags('acm-ama-config')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('admin/ama-config')
export class AmaConfigController {
  constructor(private readonly svc: AmaConfigService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'GET tenant AMA integration config',
    description: 'Returns null if no row yet (initial setup state). Use PUT to upsert.',
  })
  async get(
    @CurrentUser() u: AcmCurrentUser,
  ): Promise<AmaConfigResponseDto | null> {
    return this.svc.findByEntId(u.entId);
  }

  @Put()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Upsert tenant AMA integration config',
    description:
      'Stores the entityId + appCode that an incoming AMA SSO token must match to be allowed in. PUT is partial.',
  })
  async put(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: UpdateAmaConfigDto,
  ): Promise<AmaConfigResponseDto> {
    return this.svc.upsertByEntId(u.entId, dto);
  }
}
