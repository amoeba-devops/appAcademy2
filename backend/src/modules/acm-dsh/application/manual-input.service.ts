import { guardLegacyMarketing } from './marketing-resolver';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ManualInputTypeormEntity } from '../infrastructure/typeorm/manual-input.typeorm-entity';
import { UpsertManualInputDto } from './dto/manual-input.dto';
import { DailyKpiService } from './daily-kpi.service';
import type { DshSite } from './dsh-site.util';

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
      .addOrderBy('m.min_site', 'ASC', 'NULLS FIRST')
      .getMany();
  }

  /** PLN-260914B — `site` undefined/null = tenant-level (공통) row. */
  findByDate(entId: string, date: string, site?: DshSite | null) {
    return this.repo.findOne({
      where: { entId, date, site: site ? site : IsNull(), deletedAt: IsNull() },
    });
  }

  /** Upsert per (ent_id, date, site). BR-DSH-005: triggers daily_kpi update. */
  async upsert(
    entId: string,
    date: string,
    dto: UpsertManualInputDto,
    actorId?: string,
  ) {
    const site = dto.site ?? null;
    await this.repo.manager.transaction(async (manager) => {
      await guardLegacyMarketing(
        manager,
        entId,
        date,
        dto.marketingVisitor !== undefined,
        dto.marketingCost !== undefined,
      );
      const repo = manager.getRepository(ManualInputTypeormEntity);
      const existing = await repo.findOne({
        where: { entId, date, site: site ?? IsNull(), deletedAt: IsNull() },
      });
      const now = new Date();
      const costStr =
        dto.marketingCost != null ? String(dto.marketingCost) : null;
      if (existing) {
        await repo.update(
          { id: existing.id },
          {
            marketingVisitor:
              dto.marketingVisitor === undefined
                ? existing.marketingVisitor
                : dto.marketingVisitor,
            marketingCost:
              dto.marketingCost === undefined
                ? existing.marketingCost
                : costStr,
            marketingEffect:
              dto.marketingEffect === undefined
                ? existing.marketingEffect
                : dto.marketingEffect,
            csComplain:
              dto.csComplain === undefined
                ? existing.csComplain
                : dto.csComplain,
            status: dto.status ?? existing.status,
            visitorSource:
              dto.visitorSource === undefined
                ? existing.visitorSource
                : dto.visitorSource,
            costSource:
              dto.costSource === undefined
                ? existing.costSource
                : dto.costSource,
            note: dto.note === undefined ? existing.note : dto.note,
            inputBy: actorId ?? existing.inputBy ?? null,
            updatedAt: now,
          },
        );
      } else {
        await repo.insert({
          entId,
          date,
          site,
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
    });
    await this.dailyKpi.recomputeDay(entId, date, 'manual_input');
    return this.findByDate(entId, date, site);
  }
}
