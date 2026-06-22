import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import {
  ClassroomStatus,
  ClassroomTypeormEntity,
} from '../../infrastructure/typeorm/classroom.typeorm-entity';

/** 물리 교실 마스터 — capacity 기준 수업 스케줄 충돌 검증 등에 쓰임. */
@Injectable()
export class ClassroomService {
  constructor(
    @InjectRepository(ClassroomTypeormEntity, ACM_DS)
    private readonly repo: Repository<ClassroomTypeormEntity>,
  ) {}

  async findById(entId: string, id: string): Promise<ClassroomTypeormEntity> {
    const row = await this.repo.findOne({ where: { entId, id } });
    if (!row) throw new NotFoundException({ code: 'CLASSROOM_NOT_FOUND', id });
    return row;
  }

  async list(entId: string, status: ClassroomStatus = 'ACTIVE') {
    return this.repo.find({
      where: { entId, status },
      order: { name: 'ASC' },
    });
  }

  async upsertByName(input: {
    entId: string;
    name: string;
    capacity?: number | null;
    status?: ClassroomStatus;
  }): Promise<ClassroomTypeormEntity> {
    const existing = await this.repo.findOne({
      where: { entId: input.entId, name: input.name },
    });
    if (existing) {
      if (input.capacity !== undefined) existing.capacity = input.capacity;
      if (input.status !== undefined) existing.status = input.status;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({
      entId: input.entId,
      name: input.name,
      capacity: input.capacity ?? null,
      status: input.status ?? 'ACTIVE',
    }));
  }

  async deactivate(entId: string, id: string): Promise<ClassroomTypeormEntity> {
    const row = await this.findById(entId, id);
    row.status = 'INACTIVE';
    return this.repo.save(row);
  }
}
