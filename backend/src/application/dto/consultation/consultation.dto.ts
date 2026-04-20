import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConsultationDto {
  @ApiPropertyOptional({ description: 'Parent ID' })
  @IsOptional()
  @IsNumber()
  parentId?: number;

  @ApiPropertyOptional({ description: 'Interested program ID' })
  @IsOptional()
  @IsNumber()
  interestedProgramId?: number;

  @ApiProperty({ description: 'Channel: WALK_IN, PHONE, WEBSITE, REFERRAL, OTHER' })
  @IsString()
  channel: string;

  @ApiPropertyOptional({ description: 'Assignee user ID' })
  @IsOptional()
  @IsNumber()
  assigneeUserId?: number;

  @ApiPropertyOptional({ description: 'Note' })
  @IsOptional()
  @IsString()
  note?: string;

  // Inline parent creation
  @ApiPropertyOptional({ description: 'New parent name (creates parent inline)' })
  @IsOptional()
  @IsString()
  parentName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentPhone?: string;
}

export class UpdateConsultationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  assigneeUserId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  interestedProgramId?: number;
}

export class UpdateConsultationStatusDto {
  @ApiProperty({ description: 'New status: OPEN, FOLLOW_UP, CONVERTED, LOST' })
  @IsString()
  status: string;
}

export class CreateVisitRecordDto {
  @ApiPropertyOptional({ description: 'Scheduled datetime (ISO)' })
  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Actual visit datetime (ISO)' })
  @IsOptional()
  @IsString()
  visitedAt?: string;

  @ApiPropertyOptional({ description: 'Outcome' })
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  memo?: string;
}

export class ConsultationResponseDto {
  id: number;
  parentId: number | null;
  parentName: string | null;
  interestedProgramId: number | null;
  channel: string;
  status: string;
  assigneeUserId: number | null;
  note: string | null;
  convertedEnrollmentId: number | null;
  visitCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class VisitRecordResponseDto {
  id: number;
  consultationId: number;
  scheduledAt: Date | null;
  visitedAt: Date | null;
  outcome: string | null;
  memo: string | null;
  createdAt: Date;
}
