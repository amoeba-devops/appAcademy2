import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { BodaConfigService } from '../application/boda-config.service';
import {
  BodaConfigResponseDto,
  UpdateBodaConfigDto,
} from '../application/dto/boda-config.dto';

/**
 * REQ-260526 v2 §5.1 — 어드민이 테넌트별 BODA 연동 설정을 조회 / 갱신한다.
 *
 * 응답에 비밀값을 절대 포함하지 않는다 (FR-BODA-CFG-3 / AC-CFG-1). 비밀은
 * `authKeyIsSet` / `eventSecretIsSet` 플래그로만 노출. 실제 복호화 결과는
 * 내부 모듈 (BodaeduServerHttpClient / Webhook handler) 만 접근할 수 있다.
 */
@ApiTags('acm-cal-boda-config')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('admin/cal/boda/config')
export class BodaConfigController {
  constructor(private readonly svc: BodaConfigService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'GET tenant BODA config (secrets never returned)',
    description:
      'Returns null if no row yet (initial setup state). Use PUT to upsert.',
  })
  async get(
    @CurrentUser() u: AcmCurrentUser,
  ): Promise<BodaConfigResponseDto | null> {
    return this.svc.findByEntId(u.entId);
  }

  @Put()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Upsert tenant BODA config',
    description:
      'Secrets (authKey, eventSecret) are encrypted with AES-256-GCM and stored as BYTEA. ' +
      'Omitted secret fields keep the previous value (PUT is partial). Response never includes secret plaintext.',
  })
  async put(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: UpdateBodaConfigDto,
  ): Promise<BodaConfigResponseDto> {
    return this.svc.upsertByEntId(u.entId, dto);
  }
}
