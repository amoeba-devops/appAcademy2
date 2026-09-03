import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { TenantSettingsService } from '../application/tenant-settings.service';

export class UpdateTenantSettingsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  timezone!: string;
}

/** REQ-260903 — 테넌트 일반 설정. 조회는 전 인증 사용자, 수정은 ADMIN. */
@ApiTags('acm-system')
@ApiBearerAuth()
@Controller()
export class TenantSettingsController {
  constructor(private readonly svc: TenantSettingsService) {}

  @Get('acm/me/tenant-settings')
  @UseGuards(AcmJwtAuthGuard)
  @ApiOperation({ summary: "Caller tenant's general settings (timezone)" })
  async get(@CurrentUser() u: AcmCurrentUser): Promise<{ timezone: string }> {
    return { timezone: await this.svc.getTimezone(u.entId) };
  }

  @Put('acm/admin/tenant-settings')
  @UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: '테넌트 타임존 설정 저장 (ADMIN)' })
  update(@CurrentUser() u: AcmCurrentUser, @Body() dto: UpdateTenantSettingsDto) {
    return this.svc.setTimezone(u.entId, dto.timezone);
  }
}
