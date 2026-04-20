import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GetPostsUseCase } from '../../application/use-cases/post';

@ApiTags('Portal — News')
@Controller('portal/news')
export class PortalNewsController {
  constructor(private readonly getPosts: GetPostsUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Public: list published news' })
  @ApiQuery({ name: 'category', required: false })
  async list(@Query('category') category?: string) {
    return this.getPosts.listPublished(1, { category });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Public: news detail by slug' })
  async detail(@Param('slug') slug: string) {
    // Try as slug first, then as numeric ID
    let post = await this.getPosts.getBySlug(1, slug);
    if (!post) {
      const id = Number(slug);
      if (!isNaN(id)) {
        post = await this.getPosts.getById(id);
      }
    }
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }
}
