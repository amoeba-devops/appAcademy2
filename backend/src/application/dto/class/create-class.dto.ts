import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SchedulePatternDto {
  @ApiProperty({ description: 'Day of week (0=Sun, 6=Sat)', example: 1 })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ description: 'Start time (HH:mm)', example: '14:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'End time (HH:mm)', example: '15:30' })
  @IsString()
  endTime: string;
}

export class CreateClassDto {
  @ApiProperty({ description: 'Program ID', example: 1 })
  @IsInt()
  programId: number;

  @ApiProperty({ description: 'Teacher ID', example: 1 })
  @IsInt()
  teacherId: number;

  @ApiPropertyOptional({ description: 'Classroom ID', example: 1 })
  @IsOptional()
  @IsInt()
  classroomId?: number;

  @ApiProperty({ description: 'Start date', example: '2026-05-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'End date', example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Capacity', example: 15 })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiProperty({ description: 'Schedule pattern', type: [SchedulePatternDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchedulePatternDto)
  schedulePattern: SchedulePatternDto[];
}
