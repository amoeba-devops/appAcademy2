import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PostService } from '../application/services/post.service';

const DEFAULT_ENT_ID =
  process.env.ACM_DEFAULT_ENT_ID ?? '00000000-0000-0000-0000-000000000001';

@ApiTags('portal-news')
@Controller('portal/news')
export class PortalNewsController {
  constructor(private readonly posts: PostService) {}

  @Get()
  @ApiOperation({ summary: 'Public news / event / result list' })
  async list(@Query('category') category?: string) {
    const categoryFilter =
      category && ['NOTICE', 'EVENT', 'RESULT'].includes(category)
        ? (category as 'NOTICE' | 'EVENT' | 'RESULT')
        : undefined;
    const rows = await this.posts.listPublished(DEFAULT_ENT_ID, categoryFilter, 50);
    return rows.map((row) => this.toDto(row));
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Public news detail by slug' })
  async findOne(@Param('slug') slug: string) {
    const row = await this.posts.findBySlug(DEFAULT_ENT_ID, slug);
    if (!row || row.status !== 'PUBLISHED' || !row.publishedAt) {
      throw new NotFoundException({ code: 'POST_NOT_FOUND', slug });
    }
    return this.toDto(row);
  }

  private toDto(row: Awaited<ReturnType<PostService['findById']>>) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      bodyMd: row.bodyMd,
      category: row.category,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
