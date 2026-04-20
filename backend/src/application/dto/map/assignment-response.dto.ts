import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignmentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  testSetId: number;

  @ApiPropertyOptional()
  testSetName: string | null;

  @ApiProperty()
  targetType: string;

  @ApiProperty()
  targetId: number;

  @ApiPropertyOptional()
  targetName: string | null;

  @ApiProperty()
  dueAt: Date;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  totalTargets: number;

  @ApiProperty()
  completedTargets: number;

  @ApiProperty()
  completionRate: number;
}