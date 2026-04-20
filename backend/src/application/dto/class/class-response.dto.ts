import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClassSessionResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  classId: number;

  @ApiProperty()
  sessionNo: number;

  @ApiProperty()
  startAt: Date;

  @ApiProperty()
  endAt: Date;

  @ApiPropertyOptional()
  plannedDurationHours: string | null;

  @ApiPropertyOptional()
  actualDurationHours: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  sessionStatus: string;

  @ApiPropertyOptional()
  cancelReason: string | null;

  @ApiPropertyOptional()
  makeupSessionId: number | null;

  @ApiPropertyOptional()
  memo: string | null;
}

export class ClassResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  programId: number;

  @ApiProperty()
  teacherId: number;

  @ApiPropertyOptional()
  classroomId: number | null;

  @ApiProperty()
  startDate: string;

  @ApiPropertyOptional()
  endDate: string | null;

  @ApiProperty()
  capacity: number;

  @ApiProperty()
  enrolledCount: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  schedulePattern: unknown;

  @ApiPropertyOptional()
  programName: string | null;

  @ApiPropertyOptional()
  teacherName: string | null;

  @ApiPropertyOptional()
  classroomName: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ClassroomResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  capacity: number | null;

  @ApiProperty()
  status: string;
}
