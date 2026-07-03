import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

export class PortalStudentQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;
}

export class PortalOptionalStudentQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class PortalTimetableQueryDto extends PortalStudentQueryDto {
  @ApiPropertyOptional({ example: '2026-07-06' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  weekStart?: string;
}
