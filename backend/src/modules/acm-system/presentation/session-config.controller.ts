import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { ConfigAdminGuard } from '../../acm-common/guards/config-admin.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RequirePasswordRotationGuard } from '../../acm-common/guards/require-password-rotation.guard';
import { TenantSettingsService } from '../application/tenant-settings.service';

class UpdateSessionHoursDto {
  @ApiProperty({ minimum: 1, maximum: 48 })
  @IsInt()
  @Min(1)
  @Max(48)
  hours!: number;
}

/** PLN-261027 — 서비스 설정 > 로그인 유지 시간 (서비스 운영자). */
@ApiTags('acm-config-session')
@ApiBearerAuth()
@UseGuards(
  AcmJwtAuthGuard,
  OwnEntityGuard,
  ConfigAdminGuard,
  RequirePasswordRotationGuard,
)
@Controller('acm/config/session')
export class SessionConfigController {
  constructor(private readonly settings: TenantSettingsService) {}

  @Get()
  get(@CurrentUser() u: AcmCurrentUser) {
    return this.settings.getSessionPolicy(u.entId);
  }

  @Put()
  @ApiOperation({
    summary:
      'Set PC/browser "keep me signed in" hours (1–48); applies from the next login',
  })
  set(@CurrentUser() u: AcmCurrentUser, @Body() dto: UpdateSessionHoursDto) {
    return this.settings.setSessionHours(u.entId, dto.hours, u.id);
  }
}
