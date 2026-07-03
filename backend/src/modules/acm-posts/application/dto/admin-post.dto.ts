import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const POST_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
const POST_CATEGORIES = ['NOTICE', 'EVENT', 'RESULT'] as const;

export class ListAdminPostsQueryDto {
  @ApiPropertyOptional({ enum: POST_STATUSES })
  @IsOptional()
  @IsIn(POST_STATUSES)
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ApiPropertyOptional({ enum: POST_CATEGORIES })
  @IsOptional()
  @IsIn(POST_CATEGORIES)
  category?: 'NOTICE' | 'EVENT' | 'RESULT';

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CreateAdminPostDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiProperty()
  @IsString()
  bodyMd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  coverImageUrl?: string;

  @ApiPropertyOptional({ enum: POST_CATEGORIES, default: 'NOTICE' })
  @IsOptional()
  @IsIn(POST_CATEGORIES)
  category?: 'NOTICE' | 'EVENT' | 'RESULT';
}

export class UpdateAdminPostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyMd?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  coverImageUrl?: string | null;

  @ApiPropertyOptional({ enum: POST_CATEGORIES })
  @IsOptional()
  @IsIn(POST_CATEGORIES)
  category?: 'NOTICE' | 'EVENT' | 'RESULT';

  @ApiPropertyOptional({ enum: POST_STATUSES })
  @IsOptional()
  @IsIn(POST_STATUSES)
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ApiPropertyOptional({ nullable: true, example: '2026-07-04T10:30:00.000Z' })
  @IsOptional()
  @IsString()
  publishedAt?: string | null;
}
