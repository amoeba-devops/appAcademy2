import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ManualInputTypeormEntity } from '../infrastructure/typeorm/manual-input.typeorm-entity';
import { UpsertManualInputDto } from './dto/manual-input.dto';
import { DailyKpiService } from './daily-kpi.service';

@Injectable()
export class ManualInputService {
  constructor(
    @InjectRepository(ManualInputTypeormEntity, ACM_DS)
    private readonly repo: Repository<ManualInputTypeormEntity>,
    private readonly dailyKpi: DailyKpiService,
  ) {}

  list(entId: string, yearMonth: string) {
    return this.repo
      .createQueryBuilder('m')
      .where('m.ent_id = :entId', { entId })
      .andWhere(`TO_CHAR(m.min_date, 'YYYY-MM') = :ym`, { ym: yearMonth })
      .andWhere('m.min_deleted_at IS NULL')
      .orderBy('m.min_date', 'ASC')
      .getMany();
  }

  findByDate(entId: string, date: string) {
    return this.repo.findOne({ where: { entId, date } });
  }

  /** Upsert per (ent_id, date). BR-DSH-005: triggers daily_kpi update. */
  async upsert(entId: string, date: string, dto: UpsertManualInputDto, actorId?: string) {
    const existing = await this.repo.findOne({ where: { entId, date } });
    const now = new Date();
    const costStr = dto.marketingCost != null ? String(dto.marketingCost) : null;
    if (existing) {
      await this.repo.update(
        { id: existing.id },
        {
          marketingVisitor: dto.marketingVisitor ?? null,
          marketingCost: costStr,
          marketingEffect: dto.marketingEffect ?? null,
          csComplain: dto.csComplain ?? null,
          status: dto.status ?? existing.status,
          visitorSource: dto.visitorSource ?? null,
          costSource: dto.costSource ?? null,
          note: dto.note ?? null,
          inputBy: actorId ?? existing.inputBy ?? null,
          updatedAt: now,
        },
      );
    } else {
      await this.repo.insert({
        entId,
        date,
        marketingVisitor: dto.marketingVisitor ?? null,
        marketingCost: costStr,
        marketingEffect: dto.marketingEffect ?? null,
        csComplain: dto.csComplain ?? null,
        status: dto.status ?? 'PARTIAL',
        visitorSource: dto.visitorSource ?? null,
        costSource: dto.costSource ?? null,
        note: dto.note ?? null,
        inputBy: actorId ?? null,
        inputAt: now,
        updatedAt: now,
      });
    }
    await this.dailyKpi.recomputeDay(entId, date, 'manual_input');
    return this.repo.findOne({ where: { entId, date } });
  }
}
