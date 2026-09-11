import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Ga4ConfigService } from '../application/ga4-config.service';
import {
  GA4_METRICS,
  type Ga4Metric,
} from '../infrastructure/typeorm/ga4-config.typeorm-entity';

export class UpdateGa4ConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  propertyId?: string;

  /** { TPI: streamId, TRINITY: streamId, SANTACROCE: streamId } */
  @IsOptional()
  @IsObject()
  streamMap?: Record<string, string>;

  /** 서비스계정 JSON 전체. undefined = 유지, '' = 삭제 */
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  saKeyJson?: string;

  @IsOptional()
  @IsIn(GA4_METRICS as readonly string[])
  metric?: Ga4Metric;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** PLN-260912 — GA4 방문자 동기화 설정 (관리자 /admin/config/ga4). */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('acm/admin/ga4-config')
export class Ga4ConfigController {
  constructor(private readonly svc: Ga4ConfigService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'GA4 설정 조회 — 서비스계정 키는 이메일·isSet만' })
  get(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.findByEntId(u.entId);
  }

  @Put()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'GA4 설정 저장 (부분 갱신)' })
  async update(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: UpdateGa4ConfigDto,
  ) {
    try {
      return await this.svc.upsertByEntId(u.entId, dto);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith('GA4_SA_KEY')) throw new BadRequestException(msg);
      throw e;
    }
  }

  @Post('test')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'GA4 연결 테스트 — 저장된 설정으로 최근 7일 리포트 1회 호출',
  })
  async test(@CurrentUser() u: AcmCurrentUser) {
    try {
      return await this.svc.testConnection(u.entId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(msg);
    }
  }
}
