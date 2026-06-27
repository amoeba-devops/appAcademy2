import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { CourseTypeormEntity } from '../infrastructure/typeorm/course.typeorm-entity';

/**
 * REQ-260626 FR-CSL-132 / Q-CSL-109 — per-tenant course master.
 * Enrollment counseling references either a master row (enr_course_id)
 * or stores a freetext value (enr_course_freetext); operators maintain
 * the master via this service.
 */
@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(CourseTypeormEntity, ACM_DS)
    private readonly repo: Repository<CourseTypeormEntity>,
  ) {}

  async findById(entId: string, id: string): Promise<CourseTypeormEntity> {
    const row = await this.repo.findOne({ where: { entId, id } });
    if (!row) throw new NotFoundException({ code: 'COURSE_NOT_FOUND', id });
    return row;
  }

  list(entId: string, includeInactive = false): Promise<CourseTypeormEntity[]> {
    const where = includeInactive ? { entId } : { entId, isActive: true };
    return this.repo.find({ where, order: { code: 'ASC' } });
  }

  async create(input: {
    entId: string;
    code: string;
    name: string;
  }): Promise<CourseTypeormEntity> {
    // Codes are upper-case slugs ('MAP', 'ISEE'…) — normalize so operators
    // don't accidentally create 'map' and 'MAP' separately.
    const code = input.code.trim().toUpperCase();
    const existing = await this.repo.findOne({
      where: { entId: input.entId, code },
    });
    if (existing) {
      throw new ConflictException({ code: 'COURSE_CODE_TAKEN', value: code });
    }
    return this.repo.save(
      this.repo.create({
        entId: input.entId,
        code,
        name: input.name.trim(),
        isActive: true,
      }),
    );
  }

  async update(
    entId: string,
    id: string,
    patch: { name?: string; isActive?: boolean },
  ): Promise<CourseTypeormEntity> {
    const row = await this.findById(entId, id);
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.isActive !== undefined) row.isActive = patch.isActive;
    return this.repo.save(row);
  }
}
