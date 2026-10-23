import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { ConfigAdminGuard } from '../../acm-common/guards/config-admin.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RequirePasswordRotationGuard } from '../../acm-common/guards/require-password-rotation.guard';
import { AdminUserService } from '../application/admin-user.service';

class UpdateAdminUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;
  @ApiProperty({ required: false, enum: ['ADMIN', 'STAFF'] })
  @IsOptional()
  @IsIn(['ADMIN', 'STAFF'])
  role?: 'ADMIN' | 'STAFF';
  @ApiProperty({ required: false, enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
class SetAdminPasswordDto {
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(120) password!: string;
  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  mustChange?: boolean;
}
class SwitchLocalDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  ids!: string[];
}

/** REQ-261024 — 서비스 설정 > 관리자 관리 (서비스 운영자 CONFIG_ADMIN). */
@ApiTags('acm-config-admins')
@ApiBearerAuth()
@UseGuards(
  AcmJwtAuthGuard,
  OwnEntityGuard,
  ConfigAdminGuard,
  RequirePasswordRotationGuard,
)
@Controller('acm/config/admins')
export class AdminUserController {
  constructor(private readonly svc: AdminUserService) {}

  @Get()
  list(
    @CurrentUser() u: AcmCurrentUser,
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('auth') auth?: string,
  ) {
    return this.svc.list(u.entId, { q, role, auth });
  }

  @Get(':id')
  get(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.get(u.entId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Edit name/email/role/status (no self-demotion, tenant master grade fixed)',
  })
  update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.svc.update(u, id, dto);
  }

  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  lock(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.lock(u, id, true);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  unlock(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.lock(u, id, false);
  }

  @Put(':id/password')
  @ApiOperation({ summary: 'Set a new password (policy-checked)' })
  setPassword(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAdminPasswordDto,
  ) {
    return this.svc.setPassword(u, id, dto.password, dto.mustChange !== false);
  }

  @Post(':id/temp-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue a 24h temporary password (mail, or shown once)',
  })
  issueTemp(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.issueTemp(u, id);
  }

  @Post('switch-local')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch accounts from AMA to local login (pinned)' })
  switchLocal(@CurrentUser() u: AcmCurrentUser, @Body() dto: SwitchLocalDto) {
    return this.svc.switchLocal(u, dto.ids);
  }
}
