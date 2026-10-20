import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
}

/** REQ-261018B — 등록 사용자 목록(서비스 운영자, 읽기 전용). */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, ConfigAdminGuard)
@Controller('acm/admin/registered-users')
export class RegisteredUserController {
  constructor(private readonly users: RegisteredUserService) {}

  @Get()
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: RegisteredUserQuery) {
    return this.users.list(u.entId, q.type, q.q);
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
