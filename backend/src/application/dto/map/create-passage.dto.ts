import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePassageDto {
  @ApiProperty({ description: 'Passage title', example: 'The Hidden Garden' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Passage body' })
  @IsString()
  body: string;

  @ApiProperty({ description: 'Grade level', example: 'G6' })
  @IsString()
  @MaxLength(10)
  gradeLevel: string;

  @ApiPropertyOptional({ description: 'Domain', example: 'RC' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  domain?: string;

  @ApiPropertyOptional({ description: 'Source metadata', example: 'MAP RC Basic Vol.1' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  @ApiPropertyOptional({ description: 'Status', example: 'DRAFT' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @ApiPropertyOptional({ description: 'Asset URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assetUrls?: string[];
}