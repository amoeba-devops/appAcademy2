import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const CAL_CATEGORIES = ['CLASS', 'MEETING', 'EVENT', 'PERSONAL'] as const;
export const CAL_PROVIDERS = ['NONE', 'GOOGLE_MEET', 'BODASCHOOL', 'OTHER'] as const;
export const CAL_INVITEE_KINDS = ['STUDENT', 'TEACHER', 'PARENT'] as const;

// ============================================================================
// Invitee sub-DTO
// ============================================================================
export class CalInviteeInputDto {
  @ApiProperty({ enum: CAL_INVITEE_KINDS })
  @IsIn(CAL_INVITEE_KINDS)
  kind!: typeof CAL_INVITEE_KINDS[number];

  @ApiProperty() @IsUUID()
  refId!: string;
}

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

  @ApiPropertyOptional({ type: [CalInviteeInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CalInviteeInputDto)
  evtInvitees?: CalInviteeInputDto[];
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

  @ApiPropertyOptional({ type: [CalInviteeInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CalInviteeInputDto)
  evtInvitees?: CalInviteeInputDto[];
}

export class ListInviteeCandidatesQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: [...CAL_INVITEE_KINDS, 'ALL'], default: 'ALL' })
  @IsOptional() @IsString()
  kind?: string;
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

  @ApiPropertyOptional({ enum: CAL_INVITEE_KINDS, description: 'Filter events that include an invitee of this kind (admin only). Requires attendeeRefId.' })
  @IsOptional() @IsIn(CAL_INVITEE_KINDS)
  attendeeKind?: typeof CAL_INVITEE_KINDS[number];

  @ApiPropertyOptional({ description: 'Invitee ref id (UUID). Requires attendeeKind.' })
  @IsOptional() @IsUUID()
  attendeeRefId?: string;
}
