import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export type SchoolLevelDto = 'ELEMENTARY' | 'MIDDLE' | 'HIGH' | 'FOREIGN';
const LEVELS: SchoolLevelDto[] = ['ELEMENTARY', 'MIDDLE', 'HIGH', 'FOREIGN'];

export class CreateSchoolDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: LEVELS })
  @IsEnum(LEVELS)
  level!: SchoolLevelDto;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  region?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  district?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isForeign?: boolean;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  isAuthorized?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {}

export class SearchSchoolDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: LEVELS }) @IsOptional() @IsEnum(LEVELS)
  level?: SchoolLevelDto;

  @ApiPropertyOptional() @IsOptional() @IsString()
  region?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isForeign?: boolean;
}
