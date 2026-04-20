import { Inject, Injectable } from '@nestjs/common';
import type { IPostRepository } from '../../../domain/repositories/post-repository.interface';
import { POST_REPOSITORY } from '../../../domain/repositories/post-repository.interface';
import { PostResponseDto } from '../../dto/post';
import { Post } from '../../../domain/entities/post';

@Injectable()
export class GetPostsUseCase {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly postRepo: IPostRepository,
  ) {}

  async listPublished(
    academyId: number,
    filters: { category?: string },
  ): Promise<PostResponseDto[]> {
    const posts = await this.postRepo.findPublishedByAcademyId(academyId, filters);
    return posts.map((p) => this.toResponse(p));
  }

  async getById(id: number): Promise<PostResponseDto | null> {
    const p = await this.postRepo.findById(id);
    return p ? this.toResponse(p) : null;
  }

  async getBySlug(academyId: number, slug: string): Promise<PostResponseDto | null> {
    const p = await this.postRepo.findBySlug(academyId, slug);
    return p ? this.toResponse(p) : null;
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
