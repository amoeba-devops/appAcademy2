import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { RequirePasswordRotationGuard } from '../../acm-common/guards/require-password-rotation.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { GoogleAppConfigService } from '../application/google-app-config.service';

export class GoogleAppDto {
  @IsString() @MaxLength(200) clientId!: string;
  @IsOptional() @IsString() @MaxLength(200) clientSecret?: string;
  @IsString() @MaxLength(500) redirectUri!: string;
  @IsOptional() @IsString() @MaxLength(200) pickerKey?: string;
  @IsOptional() @IsString() @MaxLength(30) projectNumber?: string;
}

/** REQ-261016B — 시스템 설정 · Google OAuth 앱 (APP_ADMIN, 전 테넌트 공용). */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, RolesGuard, RequirePasswordRotationGuard)
@Roles('APP_ADMIN')
@Controller('acm/system/google-oauth')
export class SystemGoogleOauthController {
  constructor(private readonly svc: GoogleAppConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Effective Google OAuth app settings (masked)' })
  get() {
    return this.svc.view();
  }

  @Put()
  @ApiOperation({ summary: 'Save Google OAuth app settings' })
  save(@Body() dto: GoogleAppDto, @CurrentUser() u: AcmCurrentUser) {
    return this.svc.save(dto, u.id);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear saved settings (fall back to env)' })
  clear(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.clear(u.id);
  }

  @Post('test')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify client id/secret/redirect with Google' })
  test() {
    return this.svc.test();
  }
}
