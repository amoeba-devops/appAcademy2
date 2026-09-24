import {
  automaticCosts,
  applyAutomaticCost,
  AutomaticCost,
} from '../ads/ads-cost';
import { lockMarketingDay } from './marketing-resolver';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { ACM_DS } from '../../acm-common/datasource';
import { MarketingPatchDto } from './dto/marketing-input.dto';
export const MARKETING_SITES = [
  'TPI',
  'TRINITY',
  'SANTACROCE',
  'COMMON',
] as const;
type QueryDb = DataSource | EntityManager;
export type AdCost = {
  id: string | null;
  medium: string;
  amount: number;
  legacy?: boolean;
};
export interface MarketingSite {
  site: string;
  ga: number | null;
  adjustment: number | null;
  visitor: number | null;
  legacyVisitor: number | null;
  cost: number | null;
  costManaged: boolean;
  automaticCosts?: AutomaticCost[];
  automaticPending?: boolean;
  manualCost?: number | null;
  ads: AdCost[];
  effect: number | null;
}
export interface MarketingDay {
  date: string;
  revision: number;
  additive: boolean;
  costsStarted: boolean;
  legacyVisitor: number | null;
  legacyCost: number | null;
  legacyCommonCost: number | null;
  sites: MarketingSite[];
}
export function validateMarketingDate(date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new BadRequestException('INVALID_DATE');
}
const num = (v: unknown): number | null => (v == null ? null : Number(v));
export async function readMarketingDay(
  db: QueryDb,
  entId: string,
  date: string,
): Promise<MarketingDay> {
  const [days, ga, manual, daily, cached, edits, ads] = (await Promise.all([
    db.query(
      'SELECT * FROM amb_acm_dsh_marketing_day WHERE ent_id=$1 AND date=$2',
      [entId, date],
    ),
    db.query(
      "SELECT svt_site AS site,SUM(svt_visitors)::text AS value FROM amb_acm_dsh_site_visit WHERE ent_id=$1 AND svt_date=$2 AND svt_source='GA4' GROUP BY svt_site",
      [entId, date],
    ),
    db.query(
      "SELECT COALESCE(min_site,'COMMON') AS site,min_marketing_visitor AS visitor,min_marketing_cost AS cost FROM amb_acm_dsh_manual_inputs WHERE ent_id=$1 AND min_date=$2 AND min_deleted_at IS NULL",
      [entId, date],
    ),
    db.query(
      'SELECT dkp_marketing_visitor AS visitor,dkp_marketing_cost AS cost FROM amb_acm_dsh_daily_kpi WHERE ent_id=$1 AND dkp_date=$2',
      [entId, date],
    ),
    db.query(
      'SELECT dks_site AS site,dks_marketing_visitor AS visitor,dks_marketing_cost AS cost,dks_cs_counseling+dks_cs_apply AS effect FROM amb_acm_dsh_daily_kpi_site WHERE ent_id=$1 AND dks_date=$2',
      [entId, date],
    ),
    db.query(
      'SELECT * FROM amb_acm_dsh_marketing_site WHERE ent_id=$1 AND date=$2',
      [entId, date],
    ),
    db.query(
      'SELECT adc_id AS id,site,medium,amount FROM amb_acm_dsh_ad_cost WHERE ent_id=$1 AND date=$2 AND deleted_at IS NULL ORDER BY created_at,adc_id',
      [entId, date],
    ),
  ])) as [
    Array<{
      revision: number;
      additive: boolean;
      costs_started: boolean;
      legacy_common_cost: string | null;
    }>,
    Array<{ site: string; value: string }>,
    Array<{ site: string; visitor: number | null; cost: string | null }>,
    Array<{ visitor: number | null; cost: string | null }>,
    Array<{
      site: string;
      visitor: number | null;
      cost: string | null;
      effect: number;
    }>,
    Array<{ site: string; adjustment: number | null; cost_managed: boolean }>,
    Array<{ id: string; site: string; medium: string; amount: string }>,
  ];
  const policy = days[0];
  const legacySiteCost = (site: string) =>
    num(
      manual.find((r) => r.site === site)?.cost ??
        cached.find((r) => r.site === site)?.cost,
    );
  const siteCostSum = MARKETING_SITES.filter((s) => s !== 'COMMON').reduce(
    (sum, s) => sum + (legacySiteCost(s) ?? 0),
    0,
  );
  const commonCost = policy?.costs_started
    ? num(policy.legacy_common_cost)
    : daily[0]?.cost != null
      ? Number(daily[0].cost) - siteCostSum
      : legacySiteCost('COMMON');
  const automatic = await automaticCosts(db, entId, date, date);
  const sites = MARKETING_SITES.map((site) => {
    const edit = edits.find((r) => r.site === site),
      m = manual.find((r) => r.site === site),
      c = cached.find((r) => r.site === site);
    const raw = num(ga.find((r) => r.site === site)?.value);
    const legacyVisitor = num(m?.visitor ?? c?.visitor ?? raw);
    const oldCost = site === 'COMMON' ? commonCost : legacySiteCost(site);
    const entries: AdCost[] = edit?.cost_managed
      ? ads
          .filter((r) => r.site === site)
          .map((r) => ({
            id: r.id,
            medium: r.medium,
            amount: Number(r.amount),
          }))
      : oldCost == null
        ? []
        : [{ id: null, medium: '', amount: oldCost, legacy: true }];
    return {
      site,
      ga: raw,
      adjustment: edit?.adjustment ?? null,
      visitor:
        site === 'COMMON'
          ? null
          : policy?.additive
            ? raw === null
              ? null
              : raw + (edit?.adjustment ?? 0)
            : legacyVisitor,
      legacyVisitor,
      cost: edit?.cost_managed
        ? entries.reduce((sum, r) => sum + r.amount, 0)
        : oldCost,
      costManaged: edit?.cost_managed ?? false,
      ads: entries,
      effect: c?.effect ?? null,
    };
  });
  for (const site of sites) {
    const auto = automatic.filter((a) => a.site === site.site);
    const resolved = applyAutomaticCost(
      site.cost,
      auto,
      (sites.find((s) => s.site === 'COMMON')?.cost ?? 0) > 0,
    );
    Object.assign(site, {
      manualCost: site.cost,
      automaticCosts: auto,
      automaticPending: resolved.pending,
    });
    site.cost = resolved.cost;
  }
  return {
    date,
    revision: policy?.revision ?? 0,
    additive: policy?.additive ?? false,
    costsStarted: policy?.costs_started ?? false,
    legacyVisitor: num(daily[0]?.visitor),
    legacyCost: num(daily[0]?.cost),
    legacyCommonCost: commonCost,
    sites,
  };
}
@Injectable()
export class MarketingInputService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  async get(entId: string, date: string) {
    validateMarketingDate(date);
    return readMarketingDay(this.ds, entId, date);
  }
  async patch(
    entId: string,
    date: string,
    dto: MarketingPatchDto,
    actorId: string,
  ) {
    validateMarketingDate(date);
    return this.ds.transaction(async (manager) => {
      await lockMarketingDay(manager, entId, date);
      await manager.query(
        'INSERT INTO amb_acm_dsh_marketing_day(ent_id,date) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [entId, date],
      );
      await manager.query(
        'SELECT revision FROM amb_acm_dsh_marketing_day WHERE ent_id=$1 AND date=$2 FOR UPDATE',
        [entId, date],
      );
      const before = await readMarketingDay(manager, entId, date);
      if (before.revision !== dto.expectedRevision)
        throw new ConflictException('MARKETING_CHANGED');
      if (new Set(dto.sites.map((s) => s.site)).size !== dto.sites.length)
        throw new BadRequestException('DUPLICATE_SITE');
      const costsChanged = dto.sites.some((s) => s.ads !== undefined);
      if (costsChanged && (before.legacyCommonCost ?? 0) < 0)
        throw new ConflictException('LEGACY_COST_MISMATCH');
      for (const site of dto.sites) {
        if (site.site === 'COMMON' && site.adjustment !== undefined)
          throw new BadRequestException('COMMON_HAS_NO_VISITOR');
        await manager.query(
          'INSERT INTO amb_acm_dsh_marketing_site(ent_id,date,site) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [entId, date, site.site],
        );
        if (site.adjustment !== undefined) {
          await manager.query(
            'UPDATE amb_acm_dsh_marketing_site SET adjustment=$4 WHERE ent_id=$1 AND date=$2 AND site=$3',
            [entId, date, site.site, site.adjustment],
          );
          await manager.query(
            'UPDATE amb_acm_dsh_marketing_day SET additive=true WHERE ent_id=$1 AND date=$2',
            [entId, date],
          );
        }
        if (site.ads !== undefined) {
          const seen = new Set<string>();
          if (site.ads.reduce((sum, r) => sum + r.amount, 0) > 999999999999)
            throw new BadRequestException('COST_LIMIT');
          const owned = before.sites
            .find((s) => s.site === site.site)!
            .ads.filter((r) => r.id)
            .map((r) => r.id!);
          for (const ad of site.ads) {
            if (!ad.medium.trim())
              throw new BadRequestException('MEDIUM_REQUIRED');
            if (ad.id && (!owned.includes(ad.id) || seen.has(ad.id)))
              throw new BadRequestException('INVALID_AD_ROW');
            const id = ad.id ?? randomUUID();
            seen.add(id);
            if (ad.id)
              await manager.query(
                'UPDATE amb_acm_dsh_ad_cost SET medium=$5,amount=$6,updated_at=now() WHERE adc_id=$1 AND ent_id=$2 AND date=$3 AND site=$4',
                [id, entId, date, site.site, ad.medium.trim(), ad.amount],
              );
            else
              await manager.query(
                'INSERT INTO amb_acm_dsh_ad_cost(adc_id,ent_id,date,site,medium,amount) VALUES($1,$2,$3,$4,$5,$6)',
                [id, entId, date, site.site, ad.medium.trim(), ad.amount],
              );
          }
          await manager.query(
            'UPDATE amb_acm_dsh_ad_cost SET deleted_at=now(),updated_at=now() WHERE ent_id=$1 AND date=$2 AND site=$3 AND deleted_at IS NULL AND NOT(adc_id=ANY($4::uuid[]))',
            [entId, date, site.site, [...seen]],
          );
          await manager.query(
            'UPDATE amb_acm_dsh_marketing_site SET cost_managed=true WHERE ent_id=$1 AND date=$2 AND site=$3',
            [entId, date, site.site],
          );
        }
      }
      if (costsChanged && !before.costsStarted)
        await manager.query(
          'UPDATE amb_acm_dsh_marketing_day SET costs_started=true,legacy_common_cost=$3 WHERE ent_id=$1 AND date=$2',
          [entId, date, before.legacyCommonCost],
        );
      await manager.query(
        'UPDATE amb_acm_dsh_marketing_day SET revision=revision+1,updated_at=now() WHERE ent_id=$1 AND date=$2',
        [entId, date],
      );
      const after = await readMarketingDay(manager, entId, date);
      if (after.sites.reduce((sum, r) => sum + (r.cost ?? 0), 0) > 999999999999)
        throw new BadRequestException('COST_LIMIT');
      await manager.query(
        'INSERT INTO amb_acm_dsh_marketing_audit(ent_id,date,actor_id,revision,before_value,after_value) VALUES($1,$2,$3,$4,$5,$6)',
        [
          entId,
          date,
          actorId,
          after.revision,
          JSON.stringify(before),
          JSON.stringify(after),
        ],
      );
      return after;
    });
  }
}
