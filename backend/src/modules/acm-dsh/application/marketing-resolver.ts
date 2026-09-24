import { automaticCosts, applyAutomaticCost } from '../ads/ads-cost';
import { ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DailyKpiTypeormEntity } from '../infrastructure/typeorm/daily-kpi.typeorm-entity';
export async function lockMarketingDay(
  manager: EntityManager,
  entId: string,
  date: string,
) {
  await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `${entId}:marketing:${date}`,
  ]);
}
export async function guardLegacyMarketing(
  manager: EntityManager,
  entId: string,
  date: string,
  visitor: boolean,
  cost: boolean,
) {
  await lockMarketingDay(manager, entId, date);
  const rows: Array<{ additive: boolean; costs_started: boolean }> =
    await manager.query(
      'SELECT additive,costs_started FROM amb_acm_dsh_marketing_day WHERE ent_id=$1 AND date=$2',
      [entId, date],
    );
  if ((visitor && rows[0]?.additive) || (cost && rows[0]?.costs_started))
    throw new ConflictException('USE_MARKETING_INPUT');
}
export interface ResolvedMarketing {
  date: string;
  site: string;
  additive: boolean;
  costs_started: boolean;
  ga: number | null;
  adjustment: number | null;
  visitor: number | null;
  cost: string | null;
}
export async function resolveMarketing(
  ds: DataSource,
  entId: string,
  from: string,
  to: string,
): Promise<ResolvedMarketing[]> {
  const rows = await ds.query<
    Array<
      Omit<ResolvedMarketing, 'ga' | 'visitor'> & {
        ga: string | null;
        visitor: string | null;
      }
    >
  >(
    `
    SELECT d.date::text, s.site, d.additive,d.costs_started,g.value AS ga,e.adjustment,
      CASE WHEN s.site='COMMON' THEN NULL WHEN g.value IS NULL THEN NULL ELSE g.value+COALESCE(e.adjustment,0) END AS visitor,
      CASE WHEN e.cost_managed THEN COALESCE(a.value,0)
           WHEN s.site='COMMON' THEN d.legacy_common_cost ELSE COALESCE(m.min_marketing_cost,k.dks_marketing_cost) END::text AS cost
    FROM amb_acm_dsh_marketing_day d CROSS JOIN (VALUES('TPI'),('TRINITY'),('SANTACROCE'),('COMMON')) s(site)
    LEFT JOIN amb_acm_dsh_marketing_site e ON e.ent_id=d.ent_id AND e.date=d.date AND e.site=s.site
    LEFT JOIN amb_acm_dsh_manual_inputs m ON m.ent_id=d.ent_id AND m.min_date=d.date AND COALESCE(m.min_site,'COMMON')=s.site AND m.min_deleted_at IS NULL
    LEFT JOIN amb_acm_dsh_daily_kpi_site k ON k.ent_id=d.ent_id AND k.dks_date=d.date AND k.dks_site=s.site
    LEFT JOIN LATERAL (SELECT SUM(svt_visitors) AS value FROM amb_acm_dsh_site_visit WHERE ent_id=d.ent_id AND svt_date=d.date AND svt_site=s.site AND svt_source='GA4') g ON true
    LEFT JOIN LATERAL (SELECT SUM(amount) AS value FROM amb_acm_dsh_ad_cost WHERE ent_id=d.ent_id AND date=d.date AND site=s.site AND deleted_at IS NULL) a ON true
    WHERE d.ent_id=$1 AND d.date BETWEEN $2 AND $3 ORDER BY d.date,s.site`,
    [entId, from, to],
  );
  const auto = await automaticCosts(ds, entId, from, to);
  return rows.map((r) => ({
    ...r,
    cost: (() => {
      const cost = applyAutomaticCost(
        r.cost == null ? null : Number(r.cost),
        auto.filter((a) => a.date === r.date && a.site === r.site),
        rows.some(
          (c) =>
            c.date === r.date && c.site === 'COMMON' && Number(c.cost ?? 0) > 0,
        ),
      ).cost;
      return cost === null ? null : String(cost);
    })(),
    ga: r.ga == null ? null : Number(r.ga),
    visitor: r.visitor == null ? null : Number(r.visitor),
  }));
}
/** Read-time overlay keeps GA refresh and manual correction independent of cached legacy KPI writes. */
export async function applyMarketingRows<
  T extends {
    date: string;
    marketingVisitor?: number | null;
    marketingCost?: string | null;
  },
>(
  ds: DataSource,
  entId: string,
  from: string,
  to: string,
  rows: T[],
  site?: string,
) {
  const changes = await resolveMarketing(ds, entId, from, to);
  const dates = [...new Set(changes.map((r) => r.date))];
  for (const date of dates) {
    const group = changes.filter(
      (r) => r.date === date && (!site || r.site === site),
    );
    if (!group.length) continue;
    let row = rows.find((r) => r.date === date);
    if (!row) {
      row = Object.assign(new DailyKpiTypeormEntity(), {
        date,
        yearMonth: date.slice(0, 7),
        dayOfMonth: Number(date.slice(8)),
        dayOfWeek: new Date(date).getUTCDay(),
        dayOfWeekKr: new Intl.DateTimeFormat('ko', {
          weekday: 'short',
          timeZone: 'UTC',
        }).format(new Date(date)),
        computationStatus: 'FRESH',
      }) as unknown as T;
      rows.push(row);
    }
    if (group[0].additive) {
      const relevant = group.filter((r) => r.site !== 'COMMON');
      row.marketingVisitor =
        relevant.length && relevant.every((r) => r.visitor !== null)
          ? relevant.reduce((sum, r) => sum + r.visitor!, 0)
          : null;
      Object.assign(row, {
        marketingGa: relevant.every((r) => r.ga !== null)
          ? relevant.reduce((sum, r) => sum + r.ga!, 0)
          : null,
        marketingAdjustment: relevant.reduce(
          (sum, r) => sum + (r.adjustment ?? 0),
          0,
        ),
        marketingVisitorKnownSubtotal: relevant.reduce(
          (sum, r) => sum + (r.visitor ?? 0),
          0,
        ),
        marketingVisitorPartial: relevant.some((r) => r.visitor === null),
        marketingVisitorPolicy: 'GA_PLUS_ADJUSTMENT',
      });
    }
    if (group[0].costs_started)
      row.marketingCost = group.some((r) => r.cost !== null)
        ? String(group.reduce((sum, r) => sum + Number(r.cost ?? 0), 0))
        : null;
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
}
