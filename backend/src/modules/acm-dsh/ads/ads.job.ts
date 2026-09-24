import { automaticCosts } from './ads-cost';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { AdsService, kstDay, shiftDay, safeError } from './ads.service';
import { AdsConnection, AdsError, days, type AdsConfig } from './ads.types';
import { lockMarketingDay } from '../application/marketing-resolver';
import { readMarketingDay } from '../application/marketing-input.service';
interface Run {
  adr_id: string;
  ent_id: string;
  adc_id: string;
  from_date: string;
  to_date: string;
  revision: number;
  fence: string;
}
@Injectable()
export class AdsJob {
  private readonly logger = new Logger(AdsJob.name);
  private busy = false;
  constructor(private readonly ads: AdsService) {}
  @Cron('*/1 * * * *')
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.schedule();
      await this.process();
    } catch {
      this.logger.error('Advertising collection failed; inspect sync history');
    } finally {
      this.busy = false;
    }
  }
  async schedule() {
    const now = new Date(Date.now() + 9 * 3600000);
    if (now.getUTCHours() < 8) return;
    const today = kstDay(),
      to = shiftDay(today, -1);
    const connections: AdsConnection[] = await this.ads.ds.query(
      'SELECT * FROM amb_acm_ads_connection WHERE active=true',
    );
    for (const c of connections) {
      const from =
        c.config.startDate > shiftDay(today, -7)
          ? c.config.startDate
          : shiftDay(today, -7);
      if (from > to) continue;
      try {
        await this.ads.enqueue(c.ent_id, c.adc_id, from, to, today);
      } catch {
        this.logger.warn('Advertising account enqueue deferred');
      }
    }
  }
  async process() {
    const run = await this.ads.ds.transaction(async (m) => {
      await m.query(
        "UPDATE amb_acm_ads_run SET status='FAILED',error_code='LEASE_EXPIRED',updated_at=now() WHERE status='RUNNING' AND lease_until<now()",
      );
      const [r]: Run[] = await m.query(
        `SELECT r.*,r.from_date::text,r.to_date::text FROM amb_acm_ads_run r WHERE r.status='QUEUED' AND NOT EXISTS(SELECT 1 FROM amb_acm_ads_run p WHERE p.adc_id=r.adc_id AND p.status='RUNNING') ORDER BY r.created_at FOR UPDATE SKIP LOCKED LIMIT 1`,
      );
      if (!r) return null;
      // Advisory lock serializes claims for the same account across workers.
      const [lock]: Array<{ ok: boolean }> = await m.query(
        'SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS ok',
        [`ads:${r.adc_id}`],
      );
      if (!lock.ok) return null;
      const running: Array<{ exists: number }> = await m.query(
        "SELECT 1 FROM amb_acm_ads_run WHERE adc_id=$1 AND status='RUNNING'",
        [r.adc_id],
      );
      if (running.length) return null;
      r.fence = randomUUID();
      await m.query(
        "UPDATE amb_acm_ads_run SET status='RUNNING',lease_until=now()+interval '5 minutes',fence=$2,updated_at=now() WHERE adr_id=$1",
        [r.adr_id, r.fence],
      );
      return r;
    });
    if (!run) return;
    const heartbeat = setInterval(() => {
      void this.ads.ds
        .query(
          "UPDATE amb_acm_ads_run SET lease_until=now()+interval '5 minutes' WHERE adr_id=$1 AND fence=$2 AND status='RUNNING' AND lease_until>now()",
          [run.adr_id, run.fence],
        )
        .catch(() => undefined);
    }, 60000);
    try {
      const c = await this.ads.connection(run.ent_id, run.adc_id);
      if (!c.active || c.revision !== run.revision)
        throw new AdsError('CONFIG_CHANGED');
      const report = await this.ads.client.report(
        c,
        this.ads.decrypt(c),
        run.from_date,
        run.to_date,
      );
      this.ads.validateReport(c, report, run.from_date, run.to_date);
      if (c.provider === 'NAVER_SEARCH') {
        const previous: Array<{ campaign_id: string }> =
          await this.ads.ds.query(
            'SELECT DISTINCT campaign_id FROM amb_acm_ads_daily_spend WHERE ent_id=$1 AND adc_id=$2 AND date BETWEEN $3 AND $4 AND amount_micros>0',
            [run.ent_id, run.adc_id, run.from_date, run.to_date],
          );
        if (
          previous.some(
            (p) => !report.campaigns.some((c) => c.id === p.campaign_id),
          )
        )
          throw new AdsError('CAMPAIGN_HISTORY_MISSING');
      }
      let unmapped = 0;
      await this.ads.ds.transaction(async (m) => {
        await m.query(
          'SELECT adc_id FROM amb_acm_ads_connection WHERE ent_id=$1 AND adc_id=$2 FOR UPDATE',
          [run.ent_id, run.adc_id],
        );
        const latest = await this.ads.connection(run.ent_id, run.adc_id, m);
        if (!latest.active || latest.revision !== run.revision)
          throw new AdsError('CONFIG_CHANGED');
        const valid: Array<{ adr_id: string }> = await m.query(
          "SELECT adr_id FROM amb_acm_ads_run WHERE adr_id=$1 AND fence=$2 AND status='RUNNING' AND lease_until>now() FOR UPDATE",
          [run.adr_id, run.fence],
        );
        if (!valid.length) throw new AdsError('LEASE_EXPIRED');
        for (const date of days(run.from_date, run.to_date)) {
          await lockMarketingDay(m, run.ent_id, date);
          const [mapping]: Array<{ mapping: AdsConfig }> = await m.query(
            'SELECT mapping FROM amb_acm_ads_mapping WHERE ent_id=$1 AND adc_id=$2 AND effective_from<=$3 ORDER BY effective_from DESC LIMIT 1',
            [run.ent_id, run.adc_id, date],
          );
          if (!mapping) throw new AdsError('MAPPING_NOT_FOUND');
          const config = mapping.mapping;
          unmapped += report.rows.filter(
            (r) =>
              r.date === date &&
              !config.campaigns[r.campaignId] &&
              !config.defaultSite,
          ).length;
          const before = await readMarketingDay(m, run.ent_id, date);
          // A negative legacy residual is inconsistent; keep all previous successful data.
          if ((before.legacyCommonCost ?? 0) < 0)
            throw new AdsError('LEGACY_COST_MISMATCH');
          await m.query(
            'INSERT INTO amb_acm_dsh_marketing_day(ent_id,date) VALUES($1,$2) ON CONFLICT DO NOTHING',
            [run.ent_id, date],
          );
          await m.query(
            'DELETE FROM amb_acm_ads_daily_spend WHERE ent_id=$1 AND adc_id=$2 AND date=$3',
            [run.ent_id, run.adc_id, date],
          );
          for (const row of report.rows.filter((r) => r.date === date))
            await m.query(
              'INSERT INTO amb_acm_ads_daily_spend(ent_id,adc_id,date,campaign_id,campaign_name,site,amount_micros,currency,time_zone,run_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
              [
                run.ent_id,
                run.adc_id,
                date,
                row.campaignId,
                row.campaignName,
                config.campaigns[row.campaignId] ?? config.defaultSite ?? null,
                row.micros,
                report.currency,
                report.timeZone,
                run.adr_id,
              ],
            );
          const sites = [
            ...new Set([
              ...Object.values(config.campaigns),
              ...(config.defaultSite ? [config.defaultSite] : []),
            ]),
          ];
          await m.query(
            'INSERT INTO amb_acm_ads_day_coverage(ent_id,adc_id,date,sites,run_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(adc_id,date) DO UPDATE SET sites=EXCLUDED.sites,run_id=EXCLUDED.run_id,updated_at=now()',
            [run.ent_id, run.adc_id, date, JSON.stringify(sites), run.adr_id],
          );
          await m.query(
            'UPDATE amb_acm_dsh_marketing_day SET costs_started=true,legacy_common_cost=CASE WHEN costs_started THEN legacy_common_cost ELSE $3 END,revision=revision+1,updated_at=now() WHERE ent_id=$1 AND date=$2',
            [run.ent_id, date, before.legacyCommonCost],
          );
        }
        const totals = await automaticCosts(
          m,
          run.ent_id,
          run.from_date,
          run.to_date,
        );
        for (const date of days(run.from_date, run.to_date))
          if (
            totals
              .filter((r) => r.date === date)
              .reduce((sum, r) => sum + Math.max(r.original, r.amount), 0) >
            999999999999
          )
            throw new AdsError('COST_LIMIT');
        await m.query(
          "UPDATE amb_acm_ads_run SET status='SUCCEEDED',result=$3,lease_until=NULL,updated_at=now() WHERE adr_id=$1 AND fence=$2",
          [run.adr_id, run.fence, { rows: report.rows.length, unmapped }],
        );
        await m.query(
          'UPDATE amb_acm_ads_connection SET last_success_at=now(),last_error=NULL WHERE ent_id=$1 AND adc_id=$2',
          [run.ent_id, run.adc_id],
        );
        await this.ads.audit(m, run.ent_id, null, 'SYNC', run.adr_id, null, {
          from: run.from_date,
          to: run.to_date,
          rows: report.rows.length,
          unmapped,
        });
      });
    } catch (e) {
      const code = safeError(e);
      await this.ads.ds.query(
        "UPDATE amb_acm_ads_run SET status='FAILED',error_code=$3,lease_until=NULL,updated_at=now() WHERE adr_id=$1 AND fence=$2 AND status='RUNNING'",
        [run.adr_id, run.fence, code],
      );
      await this.ads.ds.query(
        'UPDATE amb_acm_ads_connection SET last_error=$3 WHERE ent_id=$1 AND adc_id=$2 AND revision=$4',
        [run.ent_id, run.adc_id, code, run.revision],
      );
    } finally {
      clearInterval(heartbeat);
    }
  }
}
