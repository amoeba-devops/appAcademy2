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
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { MailConfigService } from '../application/mail-config.service';
import { TenantMailerService } from '../application/tenant-mailer.service';
import { TestMailDto, UpdateMailConfigDto } from '../application/dto/mail-config.dto';

/** REQ-260902B — 테넌트 메일(SMTP) 설정 (관리자 /admin/config/mail). */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('acm/admin/mail-config')
export class MailConfigController {
  constructor(
    private readonly svc: MailConfigService,
    private readonly mailer: TenantMailerService,
  ) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: '메일(SMTP) 설정 조회 — 비밀번호는 isSet만' })
  get(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.findByEntId(u.entId);
  }

  @Put()
  @Roles('ADMIN')
  @ApiOperation({ summary: '메일(SMTP) 설정 저장 (부분 갱신)' })
  update(@CurrentUser() u: AcmCurrentUser, @Body() dto: UpdateMailConfigDto) {
    return this.svc.upsertByEntId(u.entId, dto);
  }

  @Post('test')
  @Roles('ADMIN')
  @ApiOperation({ summary: '테스트 메일 발송 — 저장된 테넌트 설정 기준' })
  async test(@CurrentUser() u: AcmCurrentUser, @Body() dto: TestMailDto) {
    try {
      await this.mailer.sendTest(u.entId, dto.to);
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // SMTP 오류 원문(535 인증 실패 등)을 운영자에게 그대로 보여준다.
      throw new BadRequestException(
        msg === 'MAIL_CONFIG_NOT_SET' ? 'MAIL_CONFIG_NOT_SET' : `SMTP_ERROR: ${msg}`,
      );
    }
  }
}
