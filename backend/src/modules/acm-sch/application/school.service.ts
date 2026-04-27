import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { SCHOOL_REPOSITORY, type SchoolRepository, type SchoolFilter } from '../domain/school.repository';
import type { School } from '../domain/school.entity';
import type { CreateSchoolDto, UpdateSchoolDto } from './dto/school.dto';

@Injectable()
export class SchoolService {
  constructor(
    @Inject(SCHOOL_REPOSITORY) private readonly repo: SchoolRepository,
    private readonly events: EventEmitter2,
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
    await this.repo.softDelete(entId, id);
  }
}
