import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { Ga4DataClient } from '../../acm-common/ga4/ga4-data.client';
import { Ga4ConfigService } from '../../acm-system/application/ga4-config.service';
import { SiteVisitTypeormEntity } from '../infrastructure/typeorm/site-visit.typeorm-entity';
import { DailyKpiService } from './daily-kpi.service';

export interface Ga4SyncResult {
  from: string;
  to: string;
  rowsFetched: number;
  rowsUpserted: number;
  unmappedStreams: string[];
  daysRecomputed: number;
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * PLN-260912 — GA4 Data API → amb_acm_dsh_site_visit → daily_kpi 재계산.
 * 멱등: (ent, site, date) upsert. GA4 는 최대 48h 보정되므로 잡은 D-3..D-1 을 매일 재수집.
 */
@Injectable()
export class Ga4SyncService {
  private readonly log = new Logger(Ga4SyncService.name);

  constructor(
    @InjectRepository(SiteVisitTypeormEntity, ACM_DS)
    private readonly repo: Repository<SiteVisitTypeormEntity>,
    private readonly ga4: Ga4DataClient,
    private readonly config: Ga4ConfigService,
    private readonly dailyKpi: DailyKpiService,
  ) {}

  /** Default window for the nightly job: D-3 .. D-1. */
  defaultWindow(): { from: string; to: string } {
    return { from: isoDaysAgo(3), to: isoDaysAgo(1) };
  }

  async syncRange(
    entId: string,
    from: string,
    to: string,
  ): Promise<Ga4SyncResult> {
    const cfg = await this.config.getSyncConfig(entId);
    if (!cfg) throw new Error('GA4_CONFIG_NOT_SET');

    const metrics = [cfg.metric, 'sessions', 'screenPageViews'];
    try {
      const rows = await this.ga4.runReport(cfg.key, {
        propertyId: cfg.propertyId,
        startDate: from,
        endDate: to,
        metrics,
      });

      const unmapped = new Set<string>();
      const touchedDates = new Set<string>();
      let upserted = 0;
      const now = new Date();

      for (const r of rows) {
        const site = cfg.streamToSite[r.streamId];
        if (!site) {
          unmapped.add(r.streamId);
          continue;
        }
        const visitors = Math.max(0, Math.round(r.metrics[cfg.metric] ?? 0));
        const existing = await this.repo.findOne({
          where: { entId, site, date: r.date },
        });
        if (existing) {
          await this.repo.update(
            { id: existing.id },
            {
              visitors,
              sessions: Math.round(r.metrics.sessions ?? 0),
              pageviews: Math.round(r.metrics.screenPageViews ?? 0),
              source: 'GA4',
              syncedAt: now,
              updatedAt: now,
            },
          );
        } else {
          await this.repo.insert({
            entId,
            site,
            date: r.date,
            visitors,
            sessions: Math.round(r.metrics.sessions ?? 0),
            pageviews: Math.round(r.metrics.screenPageViews ?? 0),
            source: 'GA4',
            syncedAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }
        upserted += 1;
        touchedDates.add(r.date);
      }

      // Recompute every day in the window (also days with zero rows → visitor 0)
      const days = this.enumerateDays(from, to);
      for (const day of days)
        await this.dailyKpi.recomputeDay(entId, day, 'ga4_sync');

      if (unmapped.size) {
        this.log.warn(
          `ga4-sync ent=${entId} unmapped streams: ${[...unmapped].join(',')}`,
        );
      }
      await this.config.recordSyncResult(entId, 'SUCCESS');
      const result: Ga4SyncResult = {
        from,
        to,
        rowsFetched: rows.length,
        rowsUpserted: upserted,
        unmappedStreams: [...unmapped],
        daysRecomputed: days.length,
      };
      this.log.log(
        `ga4-sync ent=${entId} ${from}..${to} fetched=${rows.length} upserted=${upserted}`,
      );
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.config.recordSyncResult(entId, 'FAILED', msg);
      throw e;
    }
  }

  /** Nightly: every active tenant, D-3..D-1. Errors are isolated per tenant. */
  async runNightly(): Promise<{ tenants: number; failed: number }> {
    const ents = await this.config.listActiveEntIds();
    const { from, to } = this.defaultWindow();
    let failed = 0;
    for (const entId of ents) {
      try {
        await this.syncRange(entId, from, to);
      } catch (e) {
        failed += 1;
        this.log.error(`ga4-sync failed ent=${entId}: ${(e as Error).message}`);
      }
    }
    return { tenants: ents.length, failed };
  }

  /** Per-site visits for a range: { [date]: { [site]: visitors } } plus per-date synced flag. */
  async getSiteVisits(
    entId: string,
    from: string,
    to: string,
  ): Promise<{
    rows: SiteVisitTypeormEntity[];
    byDate: Record<string, Record<string, number>>;
  }> {
    const rows = await this.repo.find({
      where: { entId, date: Between(from, to) },
      order: { date: 'ASC', site: 'ASC' },
    });
    const byDate: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const d =
        typeof r.date === 'string'
          ? r.date
          : new Date(r.date).toISOString().slice(0, 10);
      byDate[d] ??= {};
      byDate[d][r.site] = r.visitors;
    }
    return { rows, byDate };
  }

  /** Sum of site visitors for one day, or null when no GA4 rows exist for that day. */
  async sumVisitorsForDay(
    entId: string,
    isoDate: string,
  ): Promise<number | null> {
    const rows = await this.repo.find({ where: { entId, date: isoDate } });
    if (!rows.length) return null;
    return rows.reduce((s, r) => s + (r.visitors ?? 0), 0);
  }

  private enumerateDays(from: string, to: string): string[] {
    const out: string[] = [];
    const d = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (d <= end) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }
}
