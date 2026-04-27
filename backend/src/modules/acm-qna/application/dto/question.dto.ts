import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const STATUSES = ['OPEN', 'RESPONDED', 'RESOLVED', 'ESCALATED', 'DEFERRED'] as const;
const RESOLUTIONS = ['CONFIRMED_RESOLVED', 'UNCONFIRMED', 'UNSATISFIED', 'NA'] as const;
const RESPONSE_STATUSES = ['DRAFT', 'INTERNAL_ONLY', 'EXTERNAL_READY', 'DELIVERED'] as const;
const FAQ_VISIBILITIES = ['ADVISOR_ONLY', 'ALL_USER', 'INCLUDE_TEACHER'] as const;
export const QNA_STATUSES = STATUSES;
export const QNA_RESOLUTION_STATUSES = RESOLUTIONS;
export const QNA_RESPONSE_STATUSES = RESPONSE_STATUSES;
export const QNA_FAQ_VISIBILITIES = FAQ_VISIBILITIES;

export class CreateQuestionDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  studentId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  parentId?: string;

  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200)
  subject!: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(10000)
  body!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];
}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}

export class RespondQuestionDto {
  @ApiPropertyOptional({ description: 'Internal analytical notes' })
  @IsOptional() @IsString() @MaxLength(10000)
  internalBody?: string;

  @ApiProperty({ description: 'Parent-facing response body' })
  @IsString() @MinLength(1) @MaxLength(10000)
  externalBody!: string;

  /** Optional override for response_status. Defaults to EXTERNAL_READY when externalBody is non-empty. */
  @ApiPropertyOptional({ enum: RESPONSE_STATUSES })
  @IsOptional() @IsEnum(RESPONSE_STATUSES)
  responseStatus?: typeof RESPONSE_STATUSES[number];
}

export class ChangeQnaStatusDto {
  @ApiProperty({ enum: STATUSES }) @IsEnum(STATUSES)
  status!: typeof STATUSES[number];
}

export class MarkResolvedDto {
  @ApiProperty({ enum: RESOLUTIONS }) @IsEnum(RESOLUTIONS)
  resolutionStatus!: typeof RESOLUTIONS[number];
}

export class PromoteFaqDto {
  @ApiProperty() @IsBoolean()
  promote!: boolean;

  @ApiPropertyOptional({ enum: FAQ_VISIBILITIES, default: 'ADVISOR_ONLY' })
  @IsOptional() @IsEnum(FAQ_VISIBILITIES)
  visibility?: typeof FAQ_VISIBILITIES[number];
}
