import { Post } from '../entities/post';
import { IRepository } from './repository.interface';

export interface IPostRepository extends IRepository<Post> {
  findPublishedByAcademyId(
    academyId: number,
    filters: { category?: string },
  ): Promise<Post[]>;
  findBySlug(academyId: number, slug: string): Promise<Post | null>;
  findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; category?: string },
  ): Promise<Post[]>;
}

export const POST_REPOSITORY = Symbol('IPostRepository');
