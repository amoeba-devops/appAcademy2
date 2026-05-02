import { Inject, Injectable } from '@nestjs/common';
import { SCHOOL_REPOSITORY, type SchoolRepository } from '../domain/school.repository';
import type { School } from '../domain/school.entity';

export interface SchoolPublicDto {
  id: string;
  entId: string;
  name: string;
  level: School['level'];
  isAuthorized: boolean;
}

/**
 * Cross-module read-only facade for SCH.
 * Imported by CSL/QNA/DSH to resolve a school name without coupling to TypeORM internals.
 * Stateless — exported via AcmSchModule.
 */
@Injectable()
export class SchSchoolPublicService {
  constructor(@Inject(SCHOOL_REPOSITORY) private readonly repo: SchoolRepository) {}

  async findById(entId: string, schId: string): Promise<SchoolPublicDto | null> {
    const s = await this.repo.findById(entId, schId);
    return s ? this.toDto(s) : null;
  }

  async findByName(entId: string, name: string): Promise<SchoolPublicDto | null> {
    const s = await this.repo.findByName(entId, name);
    return s ? this.toDto(s) : null;
  }

  private toDto(s: School): SchoolPublicDto {
    return {
      id: s.id,
      entId: s.entId,
      name: s.name,
      level: s.level,
      isAuthorized: s.isAuthorized,
    };
  }
}
