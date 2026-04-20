import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTeacherDto {
  @ApiPropertyOptional({ description: 'Teaching subjects', example: ['Math', 'Physics'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teachingSubjects?: string[];

  @ApiPropertyOptional({ description: 'Employment type', enum: ['FULL_TIME', 'PART_TIME', 'FREELANCE'] })
  @IsOptional()
  @IsEnum(['FULL_TIME', 'PART_TIME', 'FREELANCE'])
  employmentType?: string;

  @ApiPropertyOptional({ description: 'Status', enum: ['ACTIVE', 'SUSPENDED', 'TERMINATED'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'SUSPENDED', 'TERMINATED'])
  status?: string;
}
