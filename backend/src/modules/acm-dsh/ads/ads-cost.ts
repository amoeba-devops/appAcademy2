import { DataSource, EntityManager } from 'typeorm';
export interface AutomaticCost {
  date: string;
  site: string;
  provider: string;
  original: number;
  amount: number;
  mode: string | null;
  adjustment: number | null;
  reason: string | null;
  manualMode: string | null;
}
/** Round once per site/provider after summing exact report micro-units. */
export async function automaticCosts(
  db: DataSource | EntityManager,
  ent: string,
  from: string,
  to: string,
): Promise<AutomaticCost[]> {
  const rows: Array<{
    date: string;
    site: string;
    provider: string;
    original: string;
    mode: string | null;
    adjustment: string | null;
    reason: string | null;
    manual_mode: string | null;
  }> = await db.query(
    `
 WITH covered AS (
 SELECT DISTINCT v.date,v.ent_id,c.provider,s.site FROM amb_acm_ads_day_coverage v
 JOIN amb_acm_ads_connection c ON c.ent_id=v.ent_id AND c.adc_id=v.adc_id
 CROSS JOIN LATERAL jsonb_array_elements_text(v.sites) s(site)
 WHERE v.ent_id=$1 AND v.date BETWEEN $2 AND $3
 ), raw AS (
 SELECT d.date,d.site,c.provider,ROUND(SUM(d.amount_micros)/1000000) AS amount
 FROM amb_acm_ads_daily_spend d JOIN amb_acm_ads_connection c ON c.ent_id=d.ent_id AND c.adc_id=d.adc_id
 WHERE d.ent_id=$1 AND d.date BETWEEN $2 AND $3 GROUP BY d.date,d.site,c.provider
 )
 SELECT v.date::text,v.site,v.provider,COALESCE(r.amount,0)::text AS original,a.mode,a.amount::text AS adjustment,a.reason,p.manual_mode
 FROM covered v LEFT JOIN raw r ON r.date=v.date AND r.site=v.site AND r.provider=v.provider
 LEFT JOIN amb_acm_ads_adjustment a ON a.ent_id=v.ent_id AND a.date=v.date AND a.site=v.site AND a.provider=v.provider
 LEFT JOIN amb_acm_ads_cost_policy p ON p.ent_id=v.ent_id AND p.date=v.date AND p.site=v.site
 ORDER BY v.date,v.site,v.provider`,
    [ent, from, to],
  );
  return rows.map((r) => {
    const original = Number(r.original),
      adjustment = r.adjustment === null ? null : Number(r.adjustment);
    return {
      date: r.date,
      site: r.site,
      provider: r.provider,
      original,
      adjustment,
      mode: r.mode,
      reason: r.reason,
      manualMode: r.manual_mode,
      amount: r.mode === 'FIXED' ? adjustment! : original + (adjustment ?? 0),
    };
  });
}
export function applyAutomaticCost(
  manual: number | null,
  rows: AutomaticCost[],
  commonConflict = false,
) {
  if (!rows.length) return { cost: manual, pending: false };
  const pending =
    commonConflict ||
    rows.some((r) => r.amount < 0) ||
    ((manual ?? 0) > 0 && !rows[0].manualMode);
  return {
    cost: pending
      ? manual
      : (rows[0].manualMode === 'REPLACE' ? 0 : (manual ?? 0)) +
        rows.reduce((sum, r) => sum + r.amount, 0),
    pending,
  };
}
