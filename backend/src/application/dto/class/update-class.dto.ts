import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  IsDateString,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SchedulePatternDto } from './create-class.dto';

export class UpdateClassDto {
  @ApiPropertyOptional({ description: 'Teacher ID' })
  @IsOptional()
  @IsInt()
  teacherId?: number;

  @ApiPropertyOptional({ description: 'Classroom ID' })
  @IsOptional()
  @IsInt()
  classroomId?: number;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Capacity' })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELED'],
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Schedule pattern', type: [SchedulePatternDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchedulePatternDto)
  schedulePattern?: SchedulePatternDto[];
}

export class RecordSessionDto {
  @ApiPropertyOptional({
    description: 'Session status',
    enum: ['HELD', 'CANCELLED'],
  })
  @IsOptional()
  @IsEnum(['HELD', 'CANCELLED'])
  sessionStatus?: string;

  @ApiPropertyOptional({ description: 'Actual duration hours', example: '1.5' })
  @IsOptional()
  @IsString()
  actualDurationHours?: string;

  @ApiPropertyOptional({ description: 'Cancel reason' })
  @IsOptional()
  @IsString()
  cancelReason?: string;

  @ApiPropertyOptional({ description: 'Memo' })
  @IsOptional()
  @IsString()
  memo?: string;
}
