import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ACM_DS } from '../../acm-common/datasource';
import { GradeBandTypeormEntity } from '../infrastructure/typeorm/grade-band.typeorm-entity';
import { SchoolTypeormEntity } from '../infrastructure/typeorm/school.typeorm-entity';
import type { CreateGradeBandDto, UpdateGradeBandDto } from './dto/grade-band.dto';

@Injectable()
export class GradeBandService {
  constructor(
    @InjectRepository(GradeBandTypeormEntity, ACM_DS) private readonly repo: Repository<GradeBandTypeormEntity>,
    @InjectRepository(SchoolTypeormEntity, ACM_DS) private readonly schoolRepo: Repository<SchoolTypeormEntity>,
  ) {}

  /** Verify school exists in tenant and is Authorized (AC-SCH-02). */
  private async assertAuthorizedSchool(entId: string, schId: string): Promise<SchoolTypeormEntity> {
    const school = await this.schoolRepo.findOne({ where: { id: schId, entId, deletedAt: IsNull() } });
    if (!school) throw new NotFoundException(`School ${schId} not found`);
    if (!school.isAuthorized) {
      throw new UnprocessableEntityException({ code: 'SCHOOL_NOT_AUTHORIZED', message: 'School is not authorized' });
    }
    return school;
  }

  async list(entId: string, schId: string) {
    await this.assertSchool(entId, schId);
    return this.repo.find({ where: { entId, schId, deletedAt: IsNull() }, order: { gradeMin: 'ASC' } });
  }

  async create(entId: string, schId: string, dto: CreateGradeBandDto) {
    await this.assertAuthorizedSchool(entId, schId);
    if (dto.gradeMin > dto.gradeMax) {
      throw new BadRequestException('gradeMin must be <= gradeMax');
    }
    return this.repo.save(this.repo.create({
      id: randomUUID(),
      entId, schId,
      label: dto.label,
      gradeMin: dto.gradeMin,
      gradeMax: dto.gradeMax,
      note: dto.note ?? null,
    }));
  }

  async update(entId: string, schId: string, id: string, dto: UpdateGradeBandDto) {
    const found = await this.findOne(entId, schId, id);
    if (dto.label !== undefined) found.label = dto.label;
    if (dto.gradeMin !== undefined) found.gradeMin = dto.gradeMin;
    if (dto.gradeMax !== undefined) found.gradeMax = dto.gradeMax;
    if (dto.note !== undefined) found.note = dto.note;
    if (found.gradeMin > found.gradeMax) throw new BadRequestException('gradeMin must be <= gradeMax');
    return this.repo.save(found);
  }

  async remove(entId: string, schId: string, id: string) {
    const found = await this.findOne(entId, schId, id);
    await this.repo.softDelete({ id: found.id });
  }

  async findOne(entId: string, schId: string, id: string) {
    const found = await this.repo.findOne({ where: { id, entId, schId, deletedAt: IsNull() } });
    if (!found) throw new NotFoundException(`Grade band ${id} not found`);
    return found;
  }

  /** Verify school exists+tenant only (no authorization required for list/read). */
  private async assertSchool(entId: string, schId: string) {
    const school = await this.schoolRepo.findOne({ where: { id: schId, entId, deletedAt: IsNull() } });
    if (!school) throw new NotFoundException(`School ${schId} not found`);
    return school;
  }

  async countBySchool(entId: string, schId: string) {
    return this.repo.count({ where: { entId, schId, deletedAt: IsNull() } });
  }
}
