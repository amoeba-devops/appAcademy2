import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const STF_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class CreateStaffDto {
  @ApiProperty() @IsString() @MaxLength(100)
  stfName!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stfEnglishName?: string;

  @ApiProperty() @IsEmail() @MaxLength(200)
  stfEmail!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  stfPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stfPosition?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stfDepartment?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  stfHiredAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stfMemo?: string;

  @ApiPropertyOptional({ enum: STF_STATUSES, default: 'ACTIVE' })
  @IsOptional() @IsEnum(STF_STATUSES)
  stfStatus?: typeof STF_STATUSES[number];

  @ApiPropertyOptional({ description: 'true 면 amb_acm_user 계정 생성 (STAFF role)' })
  @IsOptional() @IsBoolean()
  stfCreateAccount?: boolean;

  @ApiPropertyOptional({ description: '로그인 비밀번호 (≥8자, 영문+숫자)' })
  @IsOptional() @IsString() @MinLength(8) @MaxLength(120)
  stfPassword?: string;
}

export class UpdateStaffDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stfName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stfEnglishName?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(200)
  stfEmail?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  stfPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stfPosition?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stfDepartment?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  stfHiredAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stfMemo?: string;

  @ApiPropertyOptional({ enum: STF_STATUSES })
  @IsOptional() @IsEnum(STF_STATUSES)
  stfStatus?: typeof STF_STATUSES[number];
}

export class ResetStaffPasswordDto {
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(120)
  stfPassword!: string;
}

export class ListStaffQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: [...STF_STATUSES, 'ALL'] })
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number;
}
