import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { ConfigAdminGuard } from '../../acm-common/guards/config-admin.guard';
import { PortalAccountService } from '../../acm-auth/application/portal-account.service';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import {
  INVITE_ROLES,
  UserInviteService,
  type InviteRole,
} from '../application/user-invite.service';
import {
  REGISTERED_USER_TYPES,
  RegisteredUserService,
  type RegisteredUserType,
} from '../application/registered-user.service';

export class CreateInviteDto {
  @IsEmail() @MaxLength(200) email!: string;
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsIn(INVITE_ROLES) role!: InviteRole;
  @IsOptional() @IsBoolean() grantConfigAdmin?: boolean;
}
export class InviteListQuery {
  @IsOptional()
  @IsIn(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'])
  status?: string;
}
export class AcceptInviteDto {
  @IsString() @MinLength(8) @MaxLength(120) password!: string;
}
export class RegisteredUserQuery {
  @IsOptional() @IsIn(REGISTERED_USER_TYPES) type?: RegisteredUserType;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}
class InviteTokenParam {
  @IsString() @MinLength(20) @MaxLength(100) token!: string;
}

/** REQ-261018 — 서비스 설정 › 사용자 초대(서비스 운영자). */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, ConfigAdminGuard)
@Controller('acm/admin/invites')
export class UserInviteAdminController {
  constructor(private readonly invites: UserInviteService) {}

  @Get()
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: InviteListQuery) {
    return this.invites.list(u, q.status);
  }

  @Post()
  @ApiOperation({ summary: 'Invite an administrator or staff member by email' })
  create(@CurrentUser() u: AcmCurrentUser, @Body() dto: CreateInviteDto) {
    return this.invites.create(u, dto);
  }

  @Post(':id/resend')
  resend(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invites.resend(u, id);
  }

  @Post(':id/revoke')
  revoke(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invites.revoke(u, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete an invite (REQ-261112K); pending links stop working' })
  remove(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invites.remove(u, id);
  }
}

/** REQ-261112L — 포털 계정 상태 변경 */
class PortalStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}

/** REQ-261112L — 포털 계정 비밀번호 재발급(비우면 자동 생성) */
class PortalResetDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  password?: string;
}

/** REQ-261018B — 등록 사용자 목록(서비스 운영자). REQ-261112L 포털 계정 수정·삭제. */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, ConfigAdminGuard)
@Controller('acm/admin/registered-users')
export class RegisteredUserController {
  constructor(
    private readonly users: RegisteredUserService,
    private readonly portal: PortalAccountService,
  ) {}

  @Get()
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: RegisteredUserQuery) {
    return this.users.list(u.entId, q.type, q.q);
  }

  @Patch('portal/:id')
  @ApiOperation({ summary: 'Set portal account status (REQ-261112L)' })
  setPortalStatus(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PortalStatusDto,
  ) {
    return this.portal.setStatus(u.entId, id, dto.status);
  }

  @Post('portal/:id/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reissue a portal password (REQ-261112L)' })
  resetPortal(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PortalResetDto,
  ) {
    return this.portal.reissuePassword(u.entId, id, dto.password, u.id);
  }

  @Delete('portal/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a portal login account (REQ-261112L)' })
  deletePortal(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portal.softDelete(u.entId, id, u.id);
  }
}

/** REQ-261018 — 초대 수락(공개, 속도 제한). */
@ApiTags('acm-auth')
@Controller('acm/auth/invites')
export class UserInvitePublicController {
  constructor(private readonly invites: UserInviteService) {}

  @Get(':token')
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  describe(@Param() p: InviteTokenParam) {
    return this.invites.describe(p.token);
  }

  @Post(':token/accept')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  accept(@Param() p: InviteTokenParam, @Body() dto: AcceptInviteDto) {
    return this.invites.accept(p.token, dto.password);
  }
}
