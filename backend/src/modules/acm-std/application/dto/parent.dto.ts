import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateParentDto {
  @ApiProperty() @IsString() @MaxLength(100)
  parName!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  parRelation?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  parPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(200)
  parEmail?: string;
}

export class UpdateParentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  parName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  parRelation?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  parPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(200)
  parEmail?: string;
}

export class ListParentsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100)
  @Type(() => Number)
  limit?: number;
}
