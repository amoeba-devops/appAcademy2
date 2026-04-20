import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TimetableQueryDto {
  @ApiPropertyOptional({ description: 'Week start date (YYYY-MM-DD). Defaults to current Monday.' })
  @IsOptional()
  @IsString()
  week?: string;

  @ApiPropertyOptional({ description: 'Filter by teacher ID' })
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional({ description: 'Filter by classroom ID' })
  @IsOptional()
  @IsString()
  classroomId?: string;
}

export class TimetableSessionResponseDto {
  id: number;
  classId: number;
  sessionNo: number;
  startAt: string;
  endAt: string;
  sessionStatus: string;
  programName: string | null;
  teacherName: string | null;
  classroomName: string | null;
  memo: string | null;
}

export class TimetableResponseDto {
  weekStart: string;
  weekEnd: string;
  sessions: TimetableSessionResponseDto[];
}
