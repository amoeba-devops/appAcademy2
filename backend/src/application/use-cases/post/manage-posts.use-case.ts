import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import type { IPostRepository } from '../../../domain/repositories/post-repository.interface';
import { POST_REPOSITORY } from '../../../domain/repositories/post-repository.interface';
import { CreatePostDto, UpdatePostDto, PostResponseDto } from '../../dto/post';
import { Post } from '../../../domain/entities/post';

@Injectable()
export class ManagePostsUseCase {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly postRepo: IPostRepository,
  ) {}

  async listAll(
    academyId: number,
    filters: { status?: string; category?: string },
  ): Promise<PostResponseDto[]> {
    const posts = await this.postRepo.findByAcademyIdWithFilters(academyId, filters);
    return posts.map((p) => this.toResponse(p));
  }

  async getById(academyId: number, id: number): Promise<PostResponseDto> {
    const p = await this.postRepo.findById(id);
    if (!p || p.academyId !== academyId) {
      throw new NotFoundException('Post not found');
    }
    return this.toResponse(p);
  }

  async create(
    academyId: number,
    authorUserId: number | null,
    dto: CreatePostDto,
  ): Promise<PostResponseDto> {
    const slugTaken = await this.postRepo.findBySlug(academyId, dto.slug);
    if (slugTaken) {
      throw new ConflictException(`Slug already in use: ${dto.slug}`);
    }
    const created = await this.postRepo.create({
      academyId,
      authorUserId,
      slug: dto.slug,
      title: dto.title,
      bodyMd: dto.bodyMd,
      coverImageUrl: dto.coverImageUrl ?? null,
      category: dto.category ?? 'NOTICE',
      status: 'DRAFT',
    });
    return this.toResponse(created);
  }

  async update(
    academyId: number,
    id: number,
    dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    const existing = await this.postRepo.findById(id);
    if (!existing || existing.academyId !== academyId) {
      throw new NotFoundException('Post not found');
    }
    if (dto.slug && dto.slug !== existing.slug) {
      const taken = await this.postRepo.findBySlug(academyId, dto.slug);
      if (taken && taken.id !== id) {
        throw new ConflictException(`Slug already in use: ${dto.slug}`);
      }
    }

    const patch: Partial<Post> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.bodyMd !== undefined) patch.bodyMd = dto.bodyMd;
    if (dto.coverImageUrl !== undefined) patch.coverImageUrl = dto.coverImageUrl;
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.status !== undefined) {
      patch.status = dto.status;
      // Auto-stamp publishedAt on first transition to PUBLISHED.
      if (dto.status === 'PUBLISHED' && !existing.publishedAt) {
        patch.publishedAt = new Date();
      }
    }
    if (dto.publishedAt !== undefined) {
      patch.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    }

    const updated = await this.postRepo.update(id, patch);
    return this.toResponse(updated);
  }

  async delete(academyId: number, id: number): Promise<void> {
    const existing = await this.postRepo.findById(id);
    if (!existing || existing.academyId !== academyId) {
      throw new NotFoundException('Post not found');
    }
    await this.postRepo.delete(id);
  }

  private toResponse(p: Post): PostResponseDto {
    const r = new PostResponseDto();
    r.id = p.id;
    r.slug = p.slug;
    r.title = p.title;
    r.bodyMd = p.bodyMd;
    r.coverImageUrl = p.coverImageUrl;
    r.category = p.category;
    r.status = p.status;
    r.publishedAt = p.publishedAt;
    r.createdAt = p.createdAt;
    return r;
  }
}
