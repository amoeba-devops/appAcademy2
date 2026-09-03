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
  IsOptional,
  IsString,
  Matches,
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
import { KakaoConfigService } from '../application/kakao-config.service';
import { SolapiAlimtalkService } from '../application/solapi-alimtalk.service';

export class UpdateKakaoConfigDto {
  @IsOptional() @IsString() @MaxLength(100)
  apiKey?: string;

  /** undefined = 유지, '' = 삭제, 값 = 교체 */
  @IsOptional() @IsString() @MaxLength(200)
  apiSecret?: string;

  @IsOptional() @IsString() @MaxLength(60)
  pfId?: string;

  @IsOptional() @IsString() @MaxLength(60)
  templateId?: string;

  @IsOptional() @IsString() @MaxLength(20)
  senderPhone?: string;

  @IsOptional() @IsBoolean()
  smsFallback?: boolean;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class KakaoTestDto {
  @IsString()
  @Matches(/^[0-9+\-() ]{9,20}$/)
  to!: string;
}

/** REQ-260903E — 카카오 알림톡(Solapi) 설정 (관리자 /admin/config/kakao). */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('acm/admin/kakao-config')
export class KakaoConfigController {
  constructor(
    private readonly svc: KakaoConfigService,
    private readonly alimtalk: SolapiAlimtalkService,
  ) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: '알림톡 설정 조회 — API Secret 은 isSet만' })
  get(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.findByEntId(u.entId);
  }

  @Put()
  @Roles('ADMIN')
  @ApiOperation({ summary: '알림톡 설정 저장 (부분 갱신)' })
  update(@CurrentUser() u: AcmCurrentUser, @Body() dto: UpdateKakaoConfigDto) {
    return this.svc.upsertByEntId(u.entId, dto);
  }

  @Post('test')
  @Roles('ADMIN')
  @ApiOperation({ summary: '알림톡 테스트 발송 — 저장된 설정·샘플 변수' })
  async test(@CurrentUser() u: AcmCurrentUser, @Body() dto: KakaoTestDto) {
    try {
      await this.alimtalk.sendTest(u.entId, dto.to);
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(
        msg === 'KAKAO_CONFIG_NOT_SET' ? 'KAKAO_CONFIG_NOT_SET' : msg,
      );
    }
  }
}
