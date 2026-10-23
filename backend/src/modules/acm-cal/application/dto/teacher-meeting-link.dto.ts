import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** REQ-261023 — teacher portal: set or clear the Google Meet link. */
export class UpdateTeacherMeetingLinkDto {
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Empty or null clears the link',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingUrl?: string | null;

  @ApiProperty({ enum: ['ONE', 'FOLLOWING'], default: 'ONE' })
  @IsOptional()
  @IsIn(['ONE', 'FOLLOWING'])
  scope?: 'ONE' | 'FOLLOWING';

  @ApiProperty({
    default: false,
    description: 'Send a link-change mail to the invitees (opt-in)',
  })
  @IsOptional()
  @IsBoolean()
  notify?: boolean;
}
