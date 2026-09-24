import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { AiConfigService } from '../application/ai-config.service';
import { TestAiConfigDto, UpdateAiConfigDto } from '../application/dto/ai-config.dto';

@ApiTags('acm-system') @ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('acm/admin/ai-config')
export class AiConfigController {
  constructor(private readonly service: AiConfigService) {}
  @Get() @Roles('ADMIN') get(@CurrentUser() user: AcmCurrentUser) { return this.service.findByEntId(user.entId); }
  @Put() @Roles('ADMIN') update(@CurrentUser() user: AcmCurrentUser, @Body() dto: UpdateAiConfigDto) { return this.service.upsert(user.entId, dto); }
  @Post('test') @Roles('ADMIN') test(@CurrentUser() user: AcmCurrentUser, @Body() dto: TestAiConfigDto) { return this.service.test(user.entId, dto); }
  @Delete('api-key') @Roles('ADMIN') removeKey(@CurrentUser() user: AcmCurrentUser) { return this.service.removeKey(user.entId); }
}
