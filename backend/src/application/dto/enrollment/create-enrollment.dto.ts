import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ description: 'Class ID (클래스 ID)' })
  @IsInt()
  @IsPositive()
  classId: number;

  @ApiProperty({ description: 'Student ID (학생 ID)' })
  @IsInt()
  @IsPositive()
  studentId: number;

  @ApiPropertyOptional({ description: 'Applied parent ID (신청 보호자 ID)' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  appliedParentId?: number;
}
