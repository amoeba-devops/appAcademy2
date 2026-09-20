import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export type SchoolLevelDto = 'ELEMENTARY' | 'MIDDLE' | 'HIGH' | 'FOREIGN';
const LEVELS: SchoolLevelDto[] = ['ELEMENTARY', 'MIDDLE', 'HIGH', 'FOREIGN'];

export class AdmissionInfoDto {
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsString() @MaxLength(200) targetLabel?: string | null;
  @IsOptional() @IsString() @MaxLength(10000) examContent?: string | null;
  @IsOptional() @IsString() @MaxLength(10000) scheduleText?: string | null;
}

export class CreateSchoolDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  curriculumDescription?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  eligibility?: string | null;
  @ApiPropertyOptional({ type: [AdmissionInfoDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AdmissionInfoDto)
  admissions?: AdmissionInfoDto[];

  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: LEVELS })
  @IsEnum(LEVELS)
  level!: SchoolLevelDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isForeign?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isAuthorized?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;
}

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {
  @IsOptional() @IsDateString() expectedUpdatedAt?: string;
}

export class SearchSchoolDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
  @IsOptional() @IsString() @MaxLength(2000) curriculum?: string;
  @IsOptional() @IsEnum(['yes', 'no', 'unknown']) authorization?:
    | 'yes'
    | 'no'
    | 'unknown';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: LEVELS })
  @IsOptional()
  @IsEnum(LEVELS)
  level?: SchoolLevelDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isForeign?: boolean;
}
