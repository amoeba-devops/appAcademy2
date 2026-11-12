import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** REQ-261112 — 학부모 메신저 종류. */
export const PARENT_MESSENGER_TYPES = [
  'KAKAOTALK',
  'LINE',
  'WECHAT',
  'WHATSAPP',
  'TELEGRAM',
  'ZALO',
] as const;

export class CreateParentDto {
  @ApiProperty() @IsString() @MaxLength(100)
  parName!: string;

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
