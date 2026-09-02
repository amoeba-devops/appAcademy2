import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** REQ-260902 — 피드백 학부모 메일 발송 요청. */
export class FeedbackEmailRecipientDto {
  @IsUUID()
  stdId!: string;

  @IsUUID()
  parId!: string;
}

export class SendFeedbackEmailDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => FeedbackEmailRecipientDto)
  recipients!: FeedbackEmailRecipientDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;
}
