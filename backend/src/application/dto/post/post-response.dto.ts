import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PostResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  bodyMd: string;

  @ApiPropertyOptional()
  coverImageUrl: string | null;

  @ApiProperty()
  category: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  publishedAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}
