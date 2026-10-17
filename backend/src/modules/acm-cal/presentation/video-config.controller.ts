import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
// REQ-261018 — 테넌트 마스터(또는 서비스 운영자). 서비스 운영자 화면에서는 링크만 숨긴다.
import { TenantSettingsGuard } from '../../acm-common/guards/tenant-master.guard';
import { VideoConfigService } from '../application/video-config.service';
import type { VideoProvider } from '../infrastructure/typeorm/video-config.typeorm-entity';
class UpdateVideoConfigDto {
  @IsIn(['GOOGLE_MEET', 'BODASCHOOL']) provider!: VideoProvider;
}
@Controller('admin/cal/video/config')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, TenantSettingsGuard)
export class VideoConfigController {
  constructor(private readonly svc: VideoConfigService) {}
  @Get()

  get(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.get(u.entId);
  }
  @Put()

  update(@CurrentUser() u: AcmCurrentUser, @Body() dto: UpdateVideoConfigDto) {
    return this.svc.update(u.entId, u.id, dto.provider);
  }
}
@Controller('acm/cal/video-capabilities')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
export class VideoCapabilitiesController {
  constructor(private readonly svc: VideoConfigService) {}
  @Get() get(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.get(u.entId);
  }
}
@Controller('portal/cal/video-capabilities')
@UseGuards(PortalJwtAuthGuard)
export class PortalVideoCapabilitiesController {
  constructor(private readonly svc: VideoConfigService) {}
  @Get() get(@PortalUser() u: PortalAuthUser) {
    return this.svc.get(u.entId);
  }
}
