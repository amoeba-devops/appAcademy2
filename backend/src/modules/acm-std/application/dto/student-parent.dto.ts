import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PARENT_MESSENGER_TYPES } from './parent.dto';

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

  @ApiPropertyOptional({ example: '+82' }) @IsOptional() @IsString() @MaxLength(8)
  @Matches(/^(\+\d{1,4})?$/)
  parCountryCode?: string;

  @ApiPropertyOptional({ enum: PARENT_MESSENGER_TYPES })
  @IsOptional() @IsIn([...PARENT_MESSENGER_TYPES, ''])
  parMessengerType?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  parMessengerId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  parMemo?: string;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  spIsPrimary?: boolean;
}
