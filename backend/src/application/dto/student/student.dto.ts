import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStudentDto {
  @ApiProperty({ description: 'Primary parent ID' })
  @IsNumber()
  primaryParentId: number;

  @ApiProperty({ description: 'Student name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Birth date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Gender (M/F)' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  school?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  grade?: string;
}

export class UpdateStudentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  school?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  grade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lifecycleStatus?: string;
}

export class StudentResponseDto {
  id: number;
  primaryParentId: number;
  name: string;
  birthDate: string | null;
  gender: string | null;
  school: string | null;
  grade: string | null;
  status: string;
  lifecycleStatus: string;
  parentName: string | null;
  createdAt: Date;
  updatedAt: Date;
}
