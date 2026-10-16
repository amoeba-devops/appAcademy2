import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsIn, IsOptional, MaxLength } from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { PasswordResetService } from '../application/password-reset.service';

export class PasswordResetRequestDto {
  @IsEmail() @MaxLength(200) email!: string;
}
export class PasswordResetListQuery {
  @IsOptional() @IsIn(['REQUESTED', 'ISSUED', 'REJECTED']) status?: string;
}

/** REQ-261017 — 로그인 화면 “비밀번호 찾기”(공개, 속도 제한, 항상 같은 응답). */
@ApiTags('acm-auth')
@Controller('acm/auth')
export class PasswordResetPublicController {
  constructor(private readonly reset: PasswordResetService) {}

  @Post('password-reset-requests')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Request a temporary password from the tenant admin',
  })
  request(@Body() dto: PasswordResetRequestDto, @Ip() ip: string) {
    return this.reset.request(dto.email, ip);
  }
}

/** REQ-261017 — 관리자: 재발급 요청 처리·임시 비밀번호 직접 발급. */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN', 'APP_ADMIN')
@Controller('acm/admin')
export class PasswordResetAdminController {
  constructor(private readonly reset: PasswordResetService) {}

  @Get('password-reset-requests')
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: PasswordResetListQuery) {
    return this.reset.list(u, q.status);
  }

  @Post('password-reset-requests/:id/issue')
  issue(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reset.issueForRequest(u, id);
  }

  @Post('password-reset-requests/:id/reject')
  reject(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reset.reject(u, id);
  }

  @Post('users/:id/temp-password')
  @ApiOperation({ summary: 'Issue a temporary password for a console user' })
  issueForUser(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reset.issueForUser(u, id);
  }
}
