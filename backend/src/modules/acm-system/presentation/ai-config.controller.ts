import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
// REQ-261018 — 테넌트 마스터(또는 서비스 운영자). 서비스 운영자 화면에서는 링크만 숨긴다.
import { TenantSettingsGuard } from '../../acm-common/guards/tenant-master.guard';
import { AiConfigService } from '../application/ai-config.service';
import { TestAiConfigDto, UpdateAiConfigDto } from '../application/dto/ai-config.dto';

@ApiTags('acm-system') @ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, TenantSettingsGuard)
@Controller('acm/admin/ai-config')
export class AiConfigController {
  constructor(private readonly service: AiConfigService) {}
  @Get()  get(@CurrentUser() user: AcmCurrentUser) { return this.service.findByEntId(user.entId); }
  @Put()  update(@CurrentUser() user: AcmCurrentUser, @Body() dto: UpdateAiConfigDto) { return this.service.upsert(user.entId, dto); }
  @Post('test')  test(@CurrentUser() user: AcmCurrentUser, @Body() dto: TestAiConfigDto) { return this.service.test(user.entId, dto); }
  @Delete('api-key')  removeKey(@CurrentUser() user: AcmCurrentUser) { return this.service.removeKey(user.entId); }
}
