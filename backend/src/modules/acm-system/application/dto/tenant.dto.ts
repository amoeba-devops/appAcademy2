import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** PLN-260708 — tenant login code (slug): lowercase letters/digits/hyphen. */
const TENANT_CODE_RE = /^[a-z0-9][a-z0-9-]*$/;
import { Type } from 'class-transformer';

export const TENANT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export class CreateTenantDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  entId!: string;

  @ApiProperty({ example: 'Trinity Academy' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ enum: TENANT_STATUSES })
  @IsOptional()
  @IsIn(TENANT_STATUSES)
  status?: TenantStatus;

  @ApiPropertyOptional({ example: 'trinity', description: '포털 로그인 학원 코드(slug)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(TENANT_CODE_RE, { message: 'code must be lowercase letters/digits/hyphen' })
  code?: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Trinity Academy' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: TENANT_STATUSES })
  @IsOptional()
  @IsIn(TENANT_STATUSES)
  status?: TenantStatus;

  @ApiPropertyOptional({ example: 'trinity', description: '포털 로그인 학원 코드(slug)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(TENANT_CODE_RE, { message: 'code must be lowercase letters/digits/hyphen' })
  code?: string;
}

export class MenuVisibilityItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  key!: string;

  @ApiProperty()
  @IsBoolean()
  visible!: boolean;
}

export class UpdateTenantMenusDto {
  @ApiProperty({ type: [MenuVisibilityItemDto] })
  @IsArray()
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => MenuVisibilityItemDto)
  items!: MenuVisibilityItemDto[];
}

export interface TenantView {
  entId: string;
  name: string;
  code: string | null;
  status: string;
  isSystem: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuConfigItem {
  key: string;
  visible: boolean;
  alwaysOn: boolean;
}
