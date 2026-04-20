import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateItemDto {
  @ApiPropertyOptional({ description: 'Passage ID', example: 1 })
  @IsOptional()
  @IsInt()
  passageId?: number;

  @ApiPropertyOptional({ description: 'Parent item ID', example: 10 })
  @IsOptional()
  @IsInt()
  parentItemId?: number;

  @ApiProperty({ description: 'Domain', example: 'RC' })
  @IsString()
  @MaxLength(20)
  domain: string;

  @ApiProperty({ description: 'Grade level', example: 'G6' })
  @IsString()
  @MaxLength(10)
  gradeLevel: string;

  @ApiProperty({ description: 'Difficulty', example: 'MEDIUM' })
  @IsString()
  @MaxLength(20)
  difficulty: string;

  @ApiProperty({ description: 'Item type', example: 'PART_A' })
  @IsString()
  @MaxLength(20)
  itemType: string;

  @ApiProperty({ description: 'Question stem' })
  @IsString()
  stem: string;

  @ApiProperty({ description: 'Options', type: [String] })
  @IsArray()
  @IsString({ each: true })
  options: string[];

  @ApiProperty({ description: 'Answer keys', type: [String] })
  @IsArray()
  @IsString({ each: true })
  answerKeys: string[];

  @ApiPropertyOptional({ description: 'Explanation' })
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiPropertyOptional({ description: 'Points', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @ApiPropertyOptional({ description: 'Status', example: 'DRAFT' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}