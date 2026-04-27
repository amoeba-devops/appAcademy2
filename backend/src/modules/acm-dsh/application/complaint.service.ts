import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ComplaintTypeormEntity } from '../infrastructure/typeorm/complaint.typeorm-entity';
import { CreateComplaintDto, UpdateComplaintDto } from './dto/complaint.dto';
import { DailyKpiService } from './daily-kpi.service';

@Injectable()
export class ComplaintService {
  constructor(
    @InjectRepository(ComplaintTypeormEntity, ACM_DS)
    private readonly repo: Repository<ComplaintTypeormEntity>,
    private readonly dailyKpi: DailyKpiService,
  ) {}

  list(entId: string, yearMonth: string) {
    return this.repo
      .createQueryBuilder('c')
      .where('c.ent_id = :entId', { entId })
      .andWhere(`TO_CHAR(c.cmp_date, 'YYYY-MM') = :ym`, { ym: yearMonth })
      .andWhere('c.cmp_deleted_at IS NULL')
      .orderBy('c.cmp_date', 'DESC')
      .getMany();
  }

  findOne(entId: string, id: string) {
    return this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
  }

  async create(entId: string, dto: CreateComplaintDto, actorId?: string) {
    const now = new Date();
    const inserted = await this.repo.save(
      this.repo.create({
        entId,
        date: dto.date,
        channel: dto.channel,
        severity: dto.severity ?? 'MEDIUM',
        subject: dto.subject ?? null,
        description: dto.description ?? null,
        linkedQnaId: dto.linkedQnaId ?? null,
        createdBy: actorId ?? null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    await this.dailyKpi.recomputeDay(entId, dto.date, 'complaint_created');
    return inserted;
  }

  async update(entId: string, id: string, dto: UpdateComplaintDto) {
    const found = await this.findOne(entId, id);
    if (!found) throw new NotFoundException(`Complaint ${id} not found`);
    await this.repo.update(
      { id },
      {
        channel: dto.channel ?? found.channel,
        severity: dto.severity ?? found.severity,
        subject: dto.subject ?? found.subject,
        description: dto.description ?? found.description,
        linkedQnaId: dto.linkedQnaId ?? found.linkedQnaId,
        updatedAt: new Date(),
      },
    );
    return this.findOne(entId, id);
  }

  async softDelete(entId: string, id: string) {
    const found = await this.findOne(entId, id);
    if (!found) throw new NotFoundException(`Complaint ${id} not found`);
    await this.repo.update({ id }, { deletedAt: new Date(), updatedAt: new Date() });
    await this.dailyKpi.recomputeDay(entId, found.date, 'complaint_deleted');
  }
}
