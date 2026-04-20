import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ description: 'Post title', example: '2026 특목고 합격 127명' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'URL slug', example: '2026-admission-results' })
  @IsString()
  @MaxLength(200)
  slug: string;

  @ApiProperty({ description: 'Body in Markdown' })
  @IsString()
  bodyMd: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;

  @ApiPropertyOptional({ description: 'Category', enum: ['RESULT', 'EVENT', 'NOTICE'] })
  @IsOptional()
  @IsEnum(['RESULT', 'EVENT', 'NOTICE'])
  category?: string;
}
