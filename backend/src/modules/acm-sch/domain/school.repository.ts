import type { School, SchoolLevel } from './school.entity';

export const SCHOOL_REPOSITORY = Symbol('SCHOOL_REPOSITORY');

export interface SchoolFilter {
  entId: string;
  q?: string;
  level?: SchoolLevel;
  region?: string;
  isForeign?: boolean;
  limit?: number;
  offset?: number;
}

export interface SchoolRepository {
  findById(entId: string, id: string): Promise<School | null>;
  findByName(entId: string, name: string): Promise<School | null>;
  search(filter: SchoolFilter): Promise<{ items: School[]; total: number }>;
  autocomplete(entId: string, prefix: string, limit?: number): Promise<School[]>;
  save(school: Omit<School, 'createdAt' | 'updatedAt'>): Promise<School>;
  update(entId: string, id: string, patch: Partial<School>): Promise<School>;
  softDelete(entId: string, id: string): Promise<void>;
}
