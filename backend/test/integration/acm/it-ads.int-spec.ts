import { AdsOAuthService } from '../../../src/modules/acm-dsh/ads/ads-oauth.service';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ConfigService } from '@nestjs/config';
import { AesGcmService } from '../../../src/modules/acm-common/crypto/aes-gcm.service';
import { AdsService } from '../../../src/modules/acm-dsh/ads/ads.service';
import { AdsProviderClient } from '../../../src/modules/acm-dsh/ads/ads-provider.client';
import { AdsJob } from '../../../src/modules/acm-dsh/ads/ads.job';
import { readMarketingDay } from '../../../src/modules/acm-dsh/application/marketing-input.service';
import { applyMarketingRows } from '../../../src/modules/acm-dsh/application/marketing-resolver';
import type { Report } from '../../../src/modules/acm-dsh/ads/ads.types';
describe('Advertising collection (PostgreSQL)', () => {
  let pg: StartedPostgreSqlContainer;
  let ds: DataSource;
  let svc: AdsService;
  let client: AdsProviderClient;
  let job: AdsJob;
  const ent = '00000000-0000-0000-0000-000000000001',
    other = '00000000-0000-0000-0000-000000000002',
    date = '2026-09-01';
  beforeAll(async () => {
    pg = await new PostgreSqlContainer(
      process.env.ACM_TEST_PG_IMAGE ?? 'postgres:16-alpine',
    ).start();
    ds = await new DataSource({
      type: 'postgres',
      url: pg.getConnectionUri(),
    }).initialize();
    await ds.query(`CREATE TABLE amb_acm_dsh_site_visit(ent_id uuid,svt_date date,svt_site text,svt_visitors integer,svt_source text DEFAULT 'GA4');
   CREATE TABLE amb_acm_dsh_manual_inputs(ent_id uuid,min_date date,min_site text,min_marketing_visitor integer,min_marketing_cost numeric,min_deleted_at timestamptz);
   CREATE TABLE amb_acm_dsh_daily_kpi(ent_id uuid,dkp_date date,dkp_marketing_visitor integer,dkp_marketing_cost numeric);
   CREATE TABLE amb_acm_dsh_daily_kpi_site(ent_id uuid,dks_date date,dks_site text,dks_marketing_visitor integer,dks_marketing_cost numeric,dks_cs_counseling integer,dks_cs_apply integer);`);
    await ds.query(
      readFileSync(
        resolve(
          __dirname,
          '../../../../sql/acm/1019-dsh-marketing-adjustments.sql',
        ),
        'utf8',
      ),
    );
    await ds.query(
      readFileSync(
        resolve(
          __dirname,
          '../../../../sql/acm/1020-ad-platform-cost-sync.sql',
        ),
        'utf8',
      ),
    );
  });
  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (pg) await pg.stop();
  });
  beforeEach(async () => {
    await ds.query('TRUNCATE amb_acm_ads_connection CASCADE');
    await ds.query(
      'TRUNCATE amb_acm_ads_adjustment,amb_acm_ads_cost_policy,amb_acm_ads_audit,amb_acm_dsh_marketing_day,amb_acm_dsh_marketing_site,amb_acm_dsh_marketing_audit,amb_acm_dsh_ad_cost,amb_acm_dsh_site_visit,amb_acm_dsh_manual_inputs,amb_acm_dsh_daily_kpi,amb_acm_dsh_daily_kpi_site',
    );
    client = new AdsProviderClient();
    svc = new AdsService(
      ds,
      new AesGcmService(new ConfigService({ ACM_PII_KEY: 'ab'.repeat(32) })),
      client,
    );
    job = new AdsJob(svc);
  });
  const report = (amount = '30000000000'): Report => ({
    currency: 'KRW',
    timeZone: 'Asia/Seoul',
    rows: [{ date, campaignId: 'one', campaignName: 'One', micros: amount }],
    campaigns: [{ id: 'one', name: 'One' }],
  });
  async function ready() {
    const c = await svc.save(ent, ent, {
      provider: 'META',
      accountId: '123',
      name: 'Test',
      config: { startDate: date, defaultSite: 'TPI', campaigns: {} },
      credentials: { accessToken: 'do-not-return' },
    });
    await ds.query(
      'UPDATE amb_acm_ads_connection SET tested_revision=revision,test_result=$2 WHERE adc_id=$1',
      [c.adc_id, { ok: true, unmapped: 0 }],
    );
    await svc.state(ent, ent, c.adc_id, c.revision, 'enable');
    return c.adc_id;
  }
  async function collect(id: string, amount = '30000000000') {
    jest.spyOn(client, 'report').mockResolvedValue(report(amount));
    await svc.enqueue(ent, id, date, date);
    await job.process();
  }
  it('encrypts secrets and isolates tenants', async () => {
    const id = await ready();
    expect(JSON.stringify(await svc.list(ent))).not.toContain('do-not-return');
    const raw = await svc.connection(ent, id);
    expect(raw.credentials_enc).not.toContain('do-not-return');
    expect(svc.decrypt(raw).accessToken).toBe('do-not-return');
    await expect(svc.connection(other, id)).rejects.toThrow();
  });
  it('collects idempotently and preserves delta/fixed corrections', async () => {
    const id = await ready();
    await collect(id);
    let day = await readMarketingDay(ds, ent, date);
    expect(day.sites[0].cost).toBe(30000);
    await svc.adjust(ent, ent, date, {
      expectedRevision: day.revision,
      site: 'TPI',
      provider: 'META',
      mode: 'DELTA',
      amount: -2000,
      reason: 'Reconcile',
    });
    await collect(id, '31000000000');
    day = await readMarketingDay(ds, ent, date);
    expect(day.sites[0].cost).toBe(29000);
    await svc.adjust(ent, ent, date, {
      expectedRevision: day.revision,
      site: 'TPI',
      provider: 'META',
      mode: 'FIXED',
      amount: 28000,
      reason: 'Fixed',
    });
    await collect(id, '32000000000');
    expect((await readMarketingDay(ds, ent, date)).sites[0].cost).toBe(28000);
    const [{ count }] = await ds.query(
      'SELECT COUNT(*)::int AS count FROM amb_acm_ads_daily_spend',
    );
    expect(count).toBe(1);
    const rows = [{ date, marketingCost: null as string | null }];
    await applyMarketingRows(ds, ent, date, date, rows);
    expect(rows[0].marketingCost).toBe('28000');
  });
  it('retains originals on failure and rejects stale edits', async () => {
    const id = await ready();
    await collect(id);
    const before = await readMarketingDay(ds, ent, date);
    jest
      .spyOn(client, 'report')
      .mockRejectedValue(new Error('secret response'));
    await svc.enqueue(ent, id, date, date);
    await job.process();
    expect((await readMarketingDay(ds, ent, date)).sites[0].cost).toBe(30000);
    expect(JSON.stringify(await svc.runs(ent, id))).not.toContain(
      'secret response',
    );
    await expect(
      svc.adjust(ent, ent, date, {
        expectedRevision: before.revision - 1,
        site: 'TPI',
        provider: 'META',
        mode: 'DELTA',
        amount: 1,
        reason: 'stale',
      }),
    ).rejects.toThrow('MARKETING_CHANGED');
  });
  it('rejects an old worker after disconnect', async () => {
    const id = await ready();
    jest.spyOn(client, 'report').mockImplementation(async () => {
      const c = await svc.connection(ent, id);
      await svc.state(ent, ent, id, c.revision, 'disconnect');
      return report();
    });
    await svc.enqueue(ent, id, date, date);
    await job.process();
    expect(
      (await ds.query('SELECT * FROM amb_acm_ads_daily_spend')).length,
    ).toBe(0);
    expect((await svc.runs(ent, id))[0].error_code).toBe('CONFIG_CHANGED');
  });
  it('preserves manual cost and requires overlap resolution', async () => {
    await ds.query(
      "INSERT INTO amb_acm_dsh_manual_inputs(ent_id,min_date,min_site,min_marketing_cost) VALUES($1,$2,'TPI',100)",
      [ent, date],
    );
    const id = await ready();
    await collect(id);
    let day = await readMarketingDay(ds, ent, date);
    expect(day.sites[0].cost).toBe(100);
    expect(day.sites[0].automaticPending).toBe(true);
    await svc.adjust(ent, ent, date, {
      expectedRevision: day.revision,
      site: 'TPI',
      provider: 'META',
      mode: 'DELTA',
      amount: 0,
      reason: 'Additional manual cost',
      manualMode: 'ADD',
    });
    day = await readMarketingDay(ds, ent, date);
    expect(day.sites[0].cost).toBe(30100);
    expect(
      Number(
        (
          await ds.query(
            'SELECT min_marketing_cost FROM amb_acm_dsh_manual_inputs',
          )
        )[0].min_marketing_cost,
      ),
    ).toBe(100);
  });
  it('removes disappeared rows only after a complete zero report', async () => {
    const id = await ready();
    await collect(id);
    jest
      .spyOn(client, 'report')
      .mockResolvedValue({ ...report(), rows: [], campaigns: [] });
    await svc.enqueue(ent, id, date, date);
    await job.process();
    expect((await readMarketingDay(ds, ent, date)).sites[0].cost).toBe(0);
  });
  it('rejects non-KRW reports', async () => {
    const id = await ready();
    jest
      .spyOn(client, 'report')
      .mockResolvedValue({ ...report(), currency: 'USD' });
    await svc.enqueue(ent, id, date, date);
    await job.process();
    expect((await svc.runs(ent, id))[0].error_code).toBe('KRW_KST_REQUIRED');
  });

  it('requires a successful test before activation and invalidates it when credentials change', async () => {
    const id = await ready();
    const c = await svc.connection(ent, id);
    const saved = await svc.save(
      ent,
      ent,
      {
        provider: c.provider,
        accountId: c.account_id,
        name: c.name,
        expectedRevision: c.revision,
        config: c.config,
        credentials: { accessToken: 'replacement' },
      },
      id,
    );
    await expect(
      svc.state(ent, ent, id, saved.revision, 'enable'),
    ).rejects.toThrow('TEST_AND_MAPPING_REQUIRED');
    expect(saved.active).toBe(false);
  });
  it('keeps historical site mapping on later reassignment', async () => {
    const id = await ready();
    await collect(id);
    const c = await svc.connection(ent, id);
    const saved = await svc.save(
      ent,
      ent,
      {
        provider: c.provider,
        accountId: c.account_id,
        name: c.name,
        expectedRevision: c.revision,
        config: {
          ...c.config,
          defaultSite: 'TRINITY',
          mappingEffectiveFrom: new Date(Date.now() + 9 * 3600000)
            .toISOString()
            .slice(0, 10),
        },
      },
      id,
    );
    await ds.query(
      'UPDATE amb_acm_ads_connection SET tested_revision=revision,test_result=$2 WHERE adc_id=$1',
      [id, { ok: true, unmapped: 0 }],
    );
    await svc.state(ent, ent, id, saved.revision, 'enable');
    await collect(id);
    const day = await readMarketingDay(ds, ent, date);
    expect(day.sites.find((r) => r.site === 'TPI')?.cost).toBe(30000);
    expect(day.sites.find((r) => r.site === 'TRINITY')?.cost).toBeNull();
  });
  it('sums all site values into the integrated dashboard', async () => {
    const id = await ready();
    const c = await svc.connection(ent, id);
    const saved = await svc.save(
      ent,
      ent,
      {
        provider: c.provider,
        accountId: c.account_id,
        name: c.name,
        expectedRevision: c.revision,
        config: {
          startDate: date,
          campaigns: { one: 'TPI', two: 'TRINITY', three: 'SANTACROCE' },
        },
      },
      id,
    );
    await ds.query(
      'UPDATE amb_acm_ads_connection SET tested_revision=revision,test_result=$2 WHERE adc_id=$1',
      [id, { ok: true, unmapped: 0 }],
    );
    await svc.state(ent, ent, id, saved.revision, 'enable');
    jest.spyOn(client, 'report').mockResolvedValue({
      ...report(),
      rows: ['one', 'two', 'three'].map((campaignId, i) => ({
        date,
        campaignId,
        campaignName: campaignId,
        micros: String((i + 1) * 1000000000),
      })),
      campaigns: ['one', 'two', 'three'].map((id) => ({ id, name: id })),
    });
    await svc.enqueue(ent, id, date, date);
    await job.process();
    const day = await readMarketingDay(ds, ent, date);
    expect(day.sites.slice(0, 3).map((r) => r.cost)).toEqual([
      1000, 2000, 3000,
    ]);
    const rows = [{ date, marketingCost: null as string | null }];
    await applyMarketingRows(ds, ent, date, date, rows);
    expect(rows[0].marketingCost).toBe('6000');
  });
  it('serializes simultaneous claims without double collection', async () => {
    const id = await ready();
    jest.spyOn(client, 'report').mockResolvedValue(report());
    await svc.enqueue(ent, id, date, date);
    await Promise.all([job.process(), new AdsJob(svc).process()]);
    expect(client.report).toHaveBeenCalledTimes(1);
  });

  it('binds OAuth state to tenant and user and consumes it once', async () => {
    const crypto = new AesGcmService(
      new ConfigService({ ACM_PII_KEY: 'ab'.repeat(32) }),
    );
    const oauth = new AdsOAuthService(
      svc,
      new ConfigService({
        ADS_GOOGLE_REDIRECT_URI:
          'https://acm.amoeba.site/admin/config/ad-platforms',
      }),
      crypto,
    );
    const c = await svc.save(ent, ent, {
      provider: 'GOOGLE',
      accountId: '456',
      name: 'Google',
      config: { startDate: date, defaultSite: 'TPI', campaigns: {} },
      credentials: { clientId: 'client', clientSecret: 'secret' },
    });
    const started = await oauth.start(ent, ent, c.adc_id);
    const state = new URL(started.url).searchParams.get('state')!;
    await expect(oauth.finish(other, ent, state, 'code')).rejects.toThrow(
      'OAUTH_STATE_INVALID',
    );
    jest
      .spyOn(client, 'request')
      .mockResolvedValue({ refresh_token: 'private-token' });
    await oauth.finish(ent, ent, state, 'code');
    expect(svc.decrypt(await svc.connection(ent, c.adc_id)).refreshToken).toBe(
      'private-token',
    );
    expect(JSON.stringify(await svc.list(ent))).not.toContain('private-token');
    await expect(oauth.finish(ent, ent, state, 'code')).rejects.toThrow(
      'OAUTH_STATE_INVALID',
    );
  });
  it('rejects a connection test when settings change while the request is pending', async () => {
    const id = await ready();
    jest.spyOn(client, 'report').mockImplementation(async () => {
      const c = await svc.connection(ent, id);
      await svc.state(ent, ent, id, c.revision, 'pause');
      return { ...report(), rows: [] };
    });
    await expect(svc.test(ent, id)).rejects.toThrow('CONNECTION_CHANGED');
  });
});
