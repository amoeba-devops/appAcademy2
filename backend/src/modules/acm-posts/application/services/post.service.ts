import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import {
  PostCategory,
  PostStatus,
  PostTypeormEntity,
} from '../../infrastructure/typeorm/post.typeorm-entity';

/** 학원 게시판 — notice / event / result. */
@Injectable()
export class PostService {
  constructor(
    @InjectRepository(PostTypeormEntity, ACM_DS)
    private readonly repo: Repository<PostTypeormEntity>,
  ) {}

  async findById(entId: string, id: string): Promise<PostTypeormEntity> {
    const row = await this.repo.findOne({ where: { entId, id } });
    if (!row) throw new NotFoundException({ code: 'POST_NOT_FOUND', id });
    return row;
  }

  async findBySlug(entId: string, slug: string): Promise<PostTypeormEntity | null> {
    return this.repo.findOne({ where: { entId, slug } });
  }

  /** Public-facing list — only PUBLISHED + has publishedAt set. */
  async listPublished(
    entId: string,
    category?: PostCategory,
    limit = 20,
  ): Promise<PostTypeormEntity[]> {
    return this.repo.find({
      where: {
        entId,
        status: 'PUBLISHED',
        publishedAt: Not(IsNull()),
        ...(category ? { category } : {}),
      },
      order: { publishedAt: 'DESC' },
      take: limit,
    });
  }

  /** Admin list — includes draft / archived. */
  async listForAdmin(
    entId: string,
    status?: PostStatus,
    limit = 50,
  ): Promise<PostTypeormEntity[]> {
    return this.repo.find({
      where: { entId, ...(status ? { status } : {}) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async upsert(input: {
    entId: string;
    slug: string;
    title: string;
    bodyMd: string;
    category?: PostCategory;
    status?: PostStatus;
    coverImageUrl?: string | null;
    authorUserId?: string | null;
    publishedAt?: Date | null;
  }): Promise<PostTypeormEntity> {
    const existing = await this.findBySlug(input.entId, input.slug);
    if (existing) {
      existing.title = input.title;
      existing.bodyMd = input.bodyMd;
      if (input.category !== undefined) existing.category = input.category;
      if (input.status !== undefined) existing.status = input.status;
      if (input.coverImageUrl !== undefined) existing.coverImageUrl = input.coverImageUrl;
      if (input.publishedAt !== undefined) existing.publishedAt = input.publishedAt;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({
      entId: input.entId,
      slug: input.slug,
      title: input.title,
      bodyMd: input.bodyMd,
      category: input.category ?? 'NOTICE',
      status: input.status ?? 'DRAFT',
      coverImageUrl: input.coverImageUrl ?? null,
      authorUserId: input.authorUserId ?? null,
      publishedAt: input.publishedAt ?? null,
    }));
  }

  async publish(entId: string, id: string): Promise<PostTypeormEntity> {
    const row = await this.findById(entId, id);
    row.status = 'PUBLISHED';
    if (!row.publishedAt) row.publishedAt = new Date();
    return this.repo.save(row);
  }

  async archive(entId: string, id: string): Promise<PostTypeormEntity> {
    const row = await this.findById(entId, id);
    row.status = 'ARCHIVED';
    return this.repo.save(row);
  }

  async update(
    entId: string,
    id: string,
    input: {
      title?: string;
      slug?: string;
      bodyMd?: string;
      category?: PostCategory;
      status?: PostStatus;
      coverImageUrl?: string | null;
      publishedAt?: Date | null;
    },
  ): Promise<PostTypeormEntity> {
    const row = await this.findById(entId, id);
    if (input.slug !== undefined && input.slug !== row.slug) {
      const dup = await this.findBySlug(entId, input.slug);
      if (dup && dup.id !== id) {
        throw new ConflictException({ code: 'POST_SLUG_DUPLICATE' });
      }
    }
    if (input.title !== undefined) row.title = input.title;
    if (input.slug !== undefined) row.slug = input.slug;
    if (input.bodyMd !== undefined) row.bodyMd = input.bodyMd;
    if (input.category !== undefined) row.category = input.category;
    if (input.coverImageUrl !== undefined) row.coverImageUrl = input.coverImageUrl;
    if (input.status !== undefined) {
      row.status = input.status;
      if (input.status === 'PUBLISHED' && input.publishedAt === undefined && !row.publishedAt) {
        row.publishedAt = new Date();
      }
    }
    if (input.publishedAt !== undefined) row.publishedAt = input.publishedAt;
    return this.repo.save(row);
  }

  async remove(entId: string, id: string): Promise<void> {
    const row = await this.findById(entId, id);
    await this.repo.remove(row);
  }
}
