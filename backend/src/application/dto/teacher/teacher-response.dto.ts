import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TeacherResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  amaClientId: string;

  @ApiPropertyOptional()
  teachingSubjects: string[] | null;

  @ApiProperty()
  employmentType: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  lastSyncedAt: Date | null;

  @ApiPropertyOptional()
  cachedName: string | null;

  @ApiPropertyOptional()
  cachedPhone: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
