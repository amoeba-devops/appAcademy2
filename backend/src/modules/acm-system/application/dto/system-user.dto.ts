import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsEntId } from '../../../acm-common/validators/ent-id';

export const ACM_USER_ROLES = [
  'APP_ADMIN',
  'ADMIN',
  'TEACHER',
  'STAFF',
] as const;
export type AcmUserRole = (typeof ACM_USER_ROLES)[number];

export const ACM_USER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type AcmUserStatus = (typeof ACM_USER_STATUSES)[number];

/** GET /acm/system/users — search/paging across all tenants (APP_ADMIN only). */
export class ListSystemUsersQueryDto {
  @ApiPropertyOptional({ description: 'Free-text match on email or name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ enum: ACM_USER_ROLES })
  @IsOptional()
  @IsIn(ACM_USER_ROLES)
  role?: AcmUserRole;

  @ApiPropertyOptional({ description: 'Filter by tenant (ent_id)' })
  @IsOptional()
  @IsEntId()
  entId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsString()
  limit?: string;
}

export class CreateSystemUserDto {
  @ApiProperty({ format: 'uuid', description: 'Target tenant ent_id' })
  @IsEntId()
  entId!: string;

  @ApiProperty({ example: 'admin@amoeba.group' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiProperty({ example: 'Amoeba System Admin' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ minLength: 8, maxLength: 120 })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  password!: string;

  @ApiProperty({ enum: ACM_USER_ROLES })
  @IsIn(ACM_USER_ROLES)
  role!: AcmUserRole;
}

export class UpdateSystemUserDto {
  @ApiPropertyOptional({ example: 'Amoeba System Admin' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ACM_USER_ROLES })
  @IsOptional()
  @IsIn(ACM_USER_ROLES)
  role?: AcmUserRole;

  @ApiPropertyOptional({ enum: ACM_USER_STATUSES })
  @IsOptional()
  @IsIn(ACM_USER_STATUSES)
  status?: AcmUserStatus;
}

export class ResetSystemUserPasswordDto {
  @ApiProperty({ minLength: 8, maxLength: 120 })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  password!: string;
}

export interface SystemUserView {
  id: string;
  entId: string;
  tenantName: string | null;
  email: string;
  name: string;
  role: string;
  status: string;
  authSource: string;
  locked: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** REQ-261016D — 보조 권한(서비스 운영자 CONFIG_ADMIN / 테넌트 마스터 TENANT_MASTER). */
  permissions: string[];
}

export const SYSTEM_USER_PERMISSIONS = [
  'CONFIG_ADMIN',
  'TENANT_MASTER',
] as const;
export type SystemUserPermission = (typeof SYSTEM_USER_PERMISSIONS)[number];

export class UpdateSystemUserPermissionsDto {
  @ApiProperty({ enum: SYSTEM_USER_PERMISSIONS, isArray: true })
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(SYSTEM_USER_PERMISSIONS, { each: true })
  permissions!: SystemUserPermission[];
}
