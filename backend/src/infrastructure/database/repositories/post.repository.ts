import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostEntity } from '../entities/post.entity';
import type { IPostRepository } from '../../../domain/repositories/post-repository.interface';
import { Post } from '../../../domain/entities/post';

@Injectable()
export class PostRepository implements IPostRepository {
  constructor(
    @InjectRepository(PostEntity)
    private readonly repo: Repository<PostEntity>,
  ) {}

  async findAll(): Promise<Post[]> {
    const entities = await this.repo.find({ order: { pstCreatedAt: 'DESC' } });
    return entities.map((e) => this.toDomain(e));
  }

  async findById(id: number): Promise<Post | null> {
    const e = await this.repo.findOneBy({ pstId: id });
    return e ? this.toDomain(e) : null;
  }

  async create(data: Partial<Post>): Promise<Post> {
    const entity = this.repo.create({
      acdId: data.academyId!,
      pstSlug: data.slug!,
      pstTitle: data.title!,
      pstBodyMd: data.bodyMd!,
      pstCoverImageUrl: data.coverImageUrl ?? null,
      pstAuthorUserId: data.authorUserId ?? null,
      pstPublishedAt: data.publishedAt ?? null,
      pstStatus: data.status ?? 'DRAFT',
      pstCategory: data.category ?? 'NOTICE',
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async update(id: number, data: Partial<Post>): Promise<Post> {
    const updateData: Partial<PostEntity> = {};
    if (data.title !== undefined) updateData.pstTitle = data.title;
    if (data.slug !== undefined) updateData.pstSlug = data.slug;
    if (data.bodyMd !== undefined) updateData.pstBodyMd = data.bodyMd;
    if (data.coverImageUrl !== undefined) updateData.pstCoverImageUrl = data.coverImageUrl;
    if (data.status !== undefined) updateData.pstStatus = data.status;
    if (data.category !== undefined) updateData.pstCategory = data.category;
    if (data.publishedAt !== undefined) updateData.pstPublishedAt = data.publishedAt;
    await this.repo.update({ pstId: id }, updateData);
    return this.findById(id) as Promise<Post>;
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ pstId: id });
  }

  async findPublishedByAcademyId(
    academyId: number,
    filters: { category?: string },
  ): Promise<Post[]> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.acd_id = :acdId', { acdId: academyId })
      .andWhere('p.pst_status = :status', { status: 'PUBLISHED' })
      .orderBy('p.pst_published_at', 'DESC');

    if (filters.category) {
      qb.andWhere('p.pst_category = :cat', { cat: filters.category });
    }

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async findBySlug(academyId: number, slug: string): Promise<Post | null> {
    const e = await this.repo.findOneBy({ acdId: academyId, pstSlug: slug });
    return e ? this.toDomain(e) : null;
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; category?: string },
  ): Promise<Post[]> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.acd_id = :acdId', { acdId: academyId })
      .orderBy('p.pst_created_at', 'DESC');

    if (filters.status) {
      qb.andWhere('p.pst_status = :status', { status: filters.status });
    }
    if (filters.category) {
      qb.andWhere('p.pst_category = :cat', { cat: filters.category });
    }

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  private toDomain(e: PostEntity): Post {
    const p = new Post();
    p.id = e.pstId;
    p.academyId = e.acdId;
    p.slug = e.pstSlug;
    p.title = e.pstTitle;
    p.bodyMd = e.pstBodyMd;
    p.coverImageUrl = e.pstCoverImageUrl;
    p.authorUserId = e.pstAuthorUserId;
    p.publishedAt = e.pstPublishedAt;
    p.status = e.pstStatus;
    p.category = e.pstCategory;
    p.createdAt = e.pstCreatedAt;
    p.updatedAt = e.pstUpdatedAt;
    return p;
  }
}
