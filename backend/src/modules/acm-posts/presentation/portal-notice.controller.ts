import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { PortalMenuService } from '../../acm-system/application/portal-menu.service';
import { PostService } from '../application/services/post.service';
import type { PostTypeormEntity } from '../infrastructure/typeorm/post.typeorm-entity';

@ApiTags('portal-notices')
@ApiBearerAuth()
@UseGuards(PortalJwtAuthGuard)
@Controller('portal/posts/notices')
export class PortalNoticeController {
  constructor(
    private readonly posts: PostService,
    private readonly menus: PortalMenuService,
  ) {}
  @Get()
  async list(@PortalUser() user: PortalAuthUser) {
    await this.menus.assertNoticeAccess(user.entId, user.kind);
    return (await this.posts.listPublished(user.entId, 'NOTICE', 50)).map(
      (row) => this.toDto(row),
    );
  }
  @Get(':slug')
  async detail(
    @PortalUser() user: PortalAuthUser,
    @Param('slug') slug: string,
  ) {
    await this.menus.assertNoticeAccess(user.entId, user.kind);
    const row = await this.posts.findBySlug(user.entId, slug);
    if (
      !row ||
      row.status !== 'PUBLISHED' ||
      !row.publishedAt ||
      row.category !== 'NOTICE'
    ) {
      throw new NotFoundException('POST_NOT_FOUND');
    }
    return this.toDto(row);
  }
  private toDto(row: PostTypeormEntity) {
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
