import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { type NotifySummary } from '../invitee-notifier.service';

/**
 * Invitee passed to instant event create. Schema mirrors
 * `CalInviteeService` input but kept inline (avoids a circular DTO import).
 */
export class InstantInviteeDto {
  @ApiProperty({ enum: ['STUDENT', 'TEACHER', 'PARENT'] })
  @IsIn(['STUDENT', 'TEACHER', 'PARENT'])
  kind!: 'STUDENT' | 'TEACHER' | 'PARENT';

  @ApiProperty({ description: 'Referenced user/student/parent/teacher UUID' })
  @IsString()
  @MaxLength(60)
  refId!: string;
}

/**
 * REQ-260610 — 즉시 강의 개설 요청 페이로드.
 *
 * 최소 입력: durationMin 만 필수. title 비우면 backend 가 자동 채움.
 * invitees 는 0 명도 허용 (강사 단독 시연 가능).
 */
export class CreateInstantEventDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiProperty({
    enum: [30, 60, 90, 120],
    description:
      'Class duration in minutes. End time = createTime + durationMin.',
  })
  @IsInt()
  @IsIn([30, 60, 90, 120])
  durationMin!: 30 | 60 | 90 | 120;

  @ApiProperty({ type: () => [InstantInviteeDto], required: false })
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => InstantInviteeDto)
  @IsOptional()
  invitees?: InstantInviteeDto[];
}

/**
 * Response payload — frontend uses launcherUrl to window.open() the
 * BODA classroom launcher in a new tab.
 */
export interface CreateInstantEventResponseDto {
  evtId: string;
  launcherUrl: string;
  meetKey: string;
  startAt: string;
  endAt: string;
  invitedCount: number;
  notifySummary: NotifySummary | null;
  /** True when the server resolved an existing event from idempotency-key. */
  deduped: boolean;
}
