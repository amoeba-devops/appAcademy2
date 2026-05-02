import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ACM_DS } from '../../acm-common/datasource';
import { ScheduleTypeormEntity } from '../infrastructure/typeorm/schedule.typeorm-entity';
import { SchoolTypeormEntity } from '../infrastructure/typeorm/school.typeorm-entity';
import type { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(ScheduleTypeormEntity, ACM_DS) private readonly repo: Repository<ScheduleTypeormEntity>,
    @InjectRepository(SchoolTypeormEntity, ACM_DS) private readonly schoolRepo: Repository<SchoolTypeormEntity>,
  ) {}

  private async assertSchool(entId: string, schId: string) {
    const school = await this.schoolRepo.findOne({ where: { id: schId, entId, deletedAt: IsNull() } });
    if (!school) throw new NotFoundException(`School ${schId} not found`);
    return school;
  }

  async list(entId: string, schId: string) {
    await this.assertSchool(entId, schId);
    return this.repo.find({
      where: { entId, schId, deletedAt: IsNull() },
      order: { year: 'DESC', type: 'ASC' },
    });
  }

  async create(entId: string, schId: string, dto: CreateScheduleDto) {
    await this.assertSchool(entId, schId);
    return this.repo.save(this.repo.create({
      id: randomUUID(),
      entId, schId,
      year: dto.year,
      type: dto.type,
      openDate: dto.openDate ?? null,
      closeDate: dto.closeDate ?? null,
      testDate: dto.testDate ?? null,
      resultDate: dto.resultDate ?? null,
      note: dto.note ?? null,
    }));
  }

  async update(entId: string, schId: string, id: string, dto: UpdateScheduleDto) {
    const found = await this.findOne(entId, schId, id);
    if (dto.year !== undefined) found.year = dto.year;
    if (dto.type !== undefined) found.type = dto.type;
    if (dto.openDate !== undefined) found.openDate = dto.openDate ?? null;
    if (dto.closeDate !== undefined) found.closeDate = dto.closeDate ?? null;
    if (dto.testDate !== undefined) found.testDate = dto.testDate ?? null;
    if (dto.resultDate !== undefined) found.resultDate = dto.resultDate ?? null;
    if (dto.note !== undefined) found.note = dto.note ?? null;
    return this.repo.save(found);
  }

  async remove(entId: string, schId: string, id: string) {
    const found = await this.findOne(entId, schId, id);
    await this.repo.softDelete({ id: found.id });
  }

  async findOne(entId: string, schId: string, id: string) {
    const found = await this.repo.findOne({ where: { id, entId, schId, deletedAt: IsNull() } });
    if (!found) throw new NotFoundException(`Schedule ${id} not found`);
    return found;
  }

  async countBySchool(entId: string, schId: string) {
    return this.repo.count({ where: { entId, schId, deletedAt: IsNull() } });
  }
}
