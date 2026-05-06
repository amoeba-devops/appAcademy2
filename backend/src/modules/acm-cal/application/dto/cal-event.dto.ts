import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const CAL_CATEGORIES = ['CLASS', 'MEETING', 'EVENT', 'PERSONAL'] as const;
export const CAL_PROVIDERS = ['NONE', 'GOOGLE_MEET', 'BODASCHOOL', 'OTHER'] as const;

export class CreateCalEventDto {
  @ApiPropertyOptional({ enum: CAL_CATEGORIES, default: 'CLASS' })
  @IsOptional() @IsEnum(CAL_CATEGORIES)
  evtCategory?: typeof CAL_CATEGORIES[number];

  @ApiProperty() @IsString() @MaxLength(200)
  evtTitle!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  evtDescription?: string;

  @ApiProperty({ description: 'ISO-8601 datetime' }) @IsDateString()
  evtStartAt!: string;

  @ApiProperty({ description: 'ISO-8601 datetime' }) @IsDateString()
  evtEndAt!: string;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  evtAllDay?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  evtLocationText?: string;

  @ApiPropertyOptional({ enum: CAL_PROVIDERS, default: 'NONE' })
  @IsOptional() @IsEnum(CAL_PROVIDERS)
  evtMeetingProvider?: typeof CAL_PROVIDERS[number];

  @ApiPropertyOptional() @IsOptional()
  @ValidateIf((o) => o.evtMeetingProvider && o.evtMeetingProvider !== 'NONE')
  @IsString() @MaxLength(500)
  @IsUrl({ require_protocol: true })
  evtMeetingUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  evtClsId?: string;

  /** Optional override (admin only — controller enforces). Default = current user. */
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  evtOwnerUserId?: string;
}

export class UpdateCalEventDto {
  @ApiPropertyOptional({ enum: CAL_CATEGORIES })
  @IsOptional() @IsEnum(CAL_CATEGORIES)
  evtCategory?: typeof CAL_CATEGORIES[number];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  evtTitle?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  evtDescription?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  evtStartAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  evtEndAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  evtAllDay?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  evtLocationText?: string;

  @ApiPropertyOptional({ enum: CAL_PROVIDERS })
  @IsOptional() @IsEnum(CAL_PROVIDERS)
  evtMeetingProvider?: typeof CAL_PROVIDERS[number];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  @IsUrl({ require_protocol: true })
  evtMeetingUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  evtClsId?: string;
}

export class ListCalEventsQueryDto {
  @ApiProperty({ description: 'ISO-8601 from datetime (inclusive)' })
  @IsDateString()
  from!: string;

  @ApiProperty({ description: 'ISO-8601 to datetime (exclusive)' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ description: 'Filter by owner user id (admin can pass any; teacher restricted server-side)' })
  @IsOptional() @IsUUID()
  ownerUserId?: string;

  @ApiPropertyOptional({ enum: CAL_CATEGORIES })
  @IsOptional() @IsEnum(CAL_CATEGORIES)
  category?: typeof CAL_CATEGORIES[number];
}
