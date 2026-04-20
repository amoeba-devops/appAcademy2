import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateEnrollmentStatusDto {
  @ApiPropertyOptional({ description: 'Enrollment status' })
  @IsString()
  @IsIn(['CONFIRMED', 'WAITLIST', 'CANCELED'])
  status: string;
}
