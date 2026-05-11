import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * REQ-260511 — Atomic link of a parent to a student.
 * Two modes:
 *  - parId provided  → reuse existing parent (optional in-place field updates)
 *  - parId omitted   → create new parent row + link
 */
export class LinkParentDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  parId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  parName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  parRelation?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  parPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(200)
  parEmail?: string;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  spIsPrimary?: boolean;
}
