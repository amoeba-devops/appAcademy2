import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeacherDto {
  @ApiProperty({ description: 'AMA Client ID', example: 'CL-001' })
  @IsString()
  amaClientId: string;

  @ApiPropertyOptional({ description: 'Teaching subjects', example: ['RC', 'Vocab'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teachingSubjects?: string[];

  @ApiProperty({ description: 'Employment type', enum: ['FULL_TIME', 'PART_TIME', 'FREELANCE'] })
  @IsEnum(['FULL_TIME', 'PART_TIME', 'FREELANCE'])
  employmentType: string;
}
