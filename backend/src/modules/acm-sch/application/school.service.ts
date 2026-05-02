import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { ACM_DS } from '../../acm-common/datasource';
import { SCHOOL_REPOSITORY, type SchoolRepository, type SchoolFilter } from '../domain/school.repository';
import type { School } from '../domain/school.entity';
import type { CreateSchoolDto, UpdateSchoolDto } from './dto/school.dto';

@Injectable()
export class SchoolService {
  constructor(
    @Inject(SCHOOL_REPOSITORY) private readonly repo: SchoolRepository,
    private readonly events: EventEmitter2,
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
  ) {}

  async create(entId: string, dto: CreateSchoolDto, actorId?: string): Promise<School> {
    const existing = await this.repo.findByName(entId, dto.name);
    if (existing) throw new ConflictException(`School with name "${dto.name}" already exists`);

    const school = await this.repo.save({
      id: randomUUID(),
      entId,
      name: dto.name,
      level: dto.level,
      region: dto.region,
      district: dto.district,
      isForeign: dto.isForeign ?? false,
      isAuthorized: dto.isAuthorized ?? true,
      notes: dto.notes,
      deletedAt: null,
    });
    this.events.emit('acm.sch.created', {
      entId, occurredAt: new Date().toISOString(), actorId,
      schoolId: school.id, name: school.name,
    });
    return school;
  }

  async findById(entId: string, id: string): Promise<School> {
    const school = await this.repo.findById(entId, id);
    if (!school) throw new NotFoundException(`School ${id} not found`);
    return school;
  }

  search(filter: SchoolFilter) {
    return this.repo.search(filter);
  }

  autocomplete(entId: string, prefix: string, limit = 10) {
    return this.repo.autocomplete(entId, prefix, limit);
  }

  async update(entId: string, id: string, dto: UpdateSchoolDto, actorId?: string): Promise<School> {
    await this.findById(entId, id);
    const updated = await this.repo.update(entId, id, dto);
    this.events.emit('acm.sch.updated', {
      entId, occurredAt: new Date().toISOString(), actorId, schoolId: id,
    });
    return updated;
  }

  async remove(entId: string, id: string): Promise<void> {
    await this.findById(entId, id);
    // AC-SCH-04: block delete if any active CSL inquiry references this school.
    // Uses raw query to avoid circular module dependency on AcmCslModule.
    try {
      const rows = await this.ds.query(
        `SELECT 1 FROM amb_acm_csl_inquiry
           WHERE ent_id = $1 AND school_id = $2 AND deleted_at IS NULL
           LIMIT 1`,
        [entId, id],
      );
      if (Array.isArray(rows) && rows.length > 0) {
        throw new UnprocessableEntityException({
          code: 'SCHOOL_IN_USE',
          message: 'School is referenced by active counseling inquiries',
        });
      }
    } catch (err: unknown) {
      // Re-throw 422; ignore "table missing" only in fresh dev DBs.
      if (err instanceof UnprocessableEntityException) throw err;
      const message = err instanceof Error ? err.message : '';
      if (!/relation .* does not exist/i.test(message)) throw err;
    }
    await this.repo.softDelete(entId, id);
  }
}
