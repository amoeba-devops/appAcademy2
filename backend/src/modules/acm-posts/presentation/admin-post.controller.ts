import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import {
  CreateAdminPostDto,
  ListAdminPostsQueryDto,
  UpdateAdminPostDto,
} from '../application/dto/admin-post.dto';
import { PostService } from '../application/services/post.service';

@ApiTags('admin-posts')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard)
@Controller('admin/posts')
export class AdminPostController {
  constructor(private readonly posts: PostService) {}

  @Get()
  @ApiOperation({ summary: 'List posts for admin management' })
  async list(
    @CurrentUser() user: AcmCurrentUser,
    @Query() query: ListAdminPostsQueryDto,
  ) {
    const rows = await this.posts.listForAdmin(
      user.entId,
      query.status,
      query.limit ?? 100,
    );
    const filtered = query.category
      ? rows.filter((row) => row.category === query.category)
      : rows;
    return filtered.map((row) => this.toDto(row));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one admin post' })
  async findOne(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.toDto(await this.posts.findById(user.entId, id));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new post draft' })
  async create(
    @CurrentUser() user: AcmCurrentUser,
    @Body() dto: CreateAdminPostDto,
  ) {
    const slug = dto.slug.trim();
    const existing = await this.posts.findBySlug(user.entId, slug);
    if (existing) {
      throw new ConflictException({ code: 'POST_SLUG_DUPLICATE' });
    }
    const row = await this.posts.upsert({
      entId: user.entId,
      slug,
      title: dto.title.trim(),
      bodyMd: dto.bodyMd.trim(),
      category: dto.category ?? 'NOTICE',
      status: 'DRAFT',
      coverImageUrl: dto.coverImageUrl?.trim() || null,
      authorUserId: user.id,
    });
    return this.toDto(row);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a post' })
  async update(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminPostDto,
  ) {
    const row = await this.posts.update(user.entId, id, {
      title: dto.title?.trim(),
      slug: dto.slug?.trim(),
      bodyMd: dto.bodyMd?.trim(),
      category: dto.category,
      status: dto.status,
      coverImageUrl:
        dto.coverImageUrl === null
          ? null
          : dto.coverImageUrl?.trim() || undefined,
      publishedAt:
        dto.publishedAt === undefined
          ? undefined
          : dto.publishedAt
            ? new Date(dto.publishedAt)
            : null,
    });
    return this.toDto(row);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post' })
  async remove(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.posts.remove(user.entId, id);
    return { success: true };
  }

  private toDto(row: Awaited<ReturnType<PostService['findById']>>) {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      bodyMd: row.bodyMd,
      coverImageUrl: row.coverImageUrl ?? null,
      category: row.category,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? null,
    };
  }
}
