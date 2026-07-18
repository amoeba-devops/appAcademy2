import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

const ENROLLMENT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CANCELED',
  'EXPIRED',
] as const;

export class ListEnrollmentsQueryDto {
  @ApiPropertyOptional({ enum: ENROLLMENT_STATUSES })
  @IsOptional()
  @IsIn(ENROLLMENT_STATUSES)
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'EXPIRED';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class UpdateEnrollmentStatusDto {
  @ApiPropertyOptional({ enum: ENROLLMENT_STATUSES })
  @IsIn(ENROLLMENT_STATUSES)
  status!: 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'EXPIRED';
}
