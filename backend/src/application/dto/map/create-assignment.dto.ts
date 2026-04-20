import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({ description: 'Target test set ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  testSetId: number;

  @ApiProperty({ description: 'Assignment target type', example: 'CLASS' })
  @IsString()
  @IsIn(['STUDENT', 'CLASS'])
  targetType: string;

  @ApiProperty({ description: 'Target student/class ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  targetId: number;

  @ApiProperty({ description: 'Assignment due datetime', example: '2026-04-30T23:59:00.000Z' })
  @IsDateString()
  dueAt: string;

  @ApiPropertyOptional({ description: 'Assignment status', example: 'ASSIGNED' })
  @IsOptional()
  @IsString()
  @IsIn(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELED'])
  status?: string;
}