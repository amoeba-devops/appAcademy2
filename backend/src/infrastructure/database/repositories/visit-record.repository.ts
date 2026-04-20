import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VisitRecordEntity } from '../entities/visit-record.entity';
import { IVisitRecordRepository } from '../../../domain/repositories/consultation-repository.interface';
import { VisitRecord } from '../../../domain/entities/visit-record';

@Injectable()
export class VisitRecordRepository implements IVisitRecordRepository {
  constructor(
    @InjectRepository(VisitRecordEntity)
    private readonly repo: Repository<VisitRecordEntity>,
  ) {}

  async findByConsultationId(consultationId: number): Promise<VisitRecord[]> {
    const entities = await this.repo.find({
      where: { cstId: consultationId },
      order: { vsrCreatedAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async create(data: Partial<VisitRecord>): Promise<VisitRecord> {
    const entity = this.repo.create({
      cstId: data.consultationId!,
      vsrScheduledAt: data.scheduledAt ?? null,
      vsrVisitedAt: data.visitedAt ?? null,
      vsrOutcome: data.outcome ?? null,
      vsrMemo: data.memo ?? null,
      vsrHandlerUserId: data.handlerUserId ?? null,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  private toDomain(e: VisitRecordEntity): VisitRecord {
    const v = new VisitRecord();
    v.id = e.vsrId;
    v.consultationId = e.cstId;
    v.scheduledAt = e.vsrScheduledAt;
    v.visitedAt = e.vsrVisitedAt;
    v.outcome = e.vsrOutcome;
    v.handlerUserId = e.vsrHandlerUserId;
    v.memo = e.vsrMemo;
    v.createdAt = e.vsrCreatedAt;
    return v;
  }
}
