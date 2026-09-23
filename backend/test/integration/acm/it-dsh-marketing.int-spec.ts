import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MarketingInputService } from '../../../src/modules/acm-dsh/application/marketing-input.service';
import {
  applyMarketingRows,
  guardLegacyMarketing,
} from '../../../src/modules/acm-dsh/application/marketing-resolver';
import { MarketingPatchDto } from '../../../src/modules/acm-dsh/application/dto/marketing-input.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('Dashboard marketing (PostgreSQL)', () => {
  let pg: StartedPostgreSqlContainer;
  let ds: DataSource;
  let service: MarketingInputService;
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
    service = new MarketingInputService(ds);
  });
  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (pg) await pg.stop();
  });
  beforeEach(async () => {
    await ds.query(
      'TRUNCATE amb_acm_dsh_marketing_day,amb_acm_dsh_marketing_site,amb_acm_dsh_ad_cost,amb_acm_dsh_marketing_audit,amb_acm_dsh_site_visit,amb_acm_dsh_manual_inputs,amb_acm_dsh_daily_kpi,amb_acm_dsh_daily_kpi_site',
    );
    await ds.query(
      `INSERT INTO amb_acm_dsh_site_visit(ent_id,svt_date,svt_site,svt_visitors) VALUES($1,$2,'TPI',10),($1,$2,'TRINITY',20),($1,$2,'SANTACROCE',30);
  `,
      [ent, date],
    );
    await ds.query(`INSERT INTO amb_acm_dsh_daily_kpi VALUES($1,$2,100,1000)`, [
      ent,
      date,
    ]);
    await ds.query(
      `INSERT INTO amb_acm_dsh_daily_kpi_site VALUES($1,$2,'TPI',40,100,2,3),($1,$2,'TRINITY',20,200,1,1),($1,$2,'SANTACROCE',30,300,0,0)`,
      [ent, date],
    );
  });
  const patch = (
    sites: MarketingPatchDto['sites'],
    expectedRevision = 0,
    tenant = ent,
  ) => service.patch(tenant, date, { expectedRevision, sites }, ent);
  const total = async () => {
    const rows = [
      {
        date,
        marketingVisitor: 100 as number | null,
        marketingCost: '1000' as string | null,
        csCounseling: 8,
      },
    ];
    await applyMarketingRows(ds, ent, date, date, rows);
    return rows[0];
  };
  it('preserves legacy values until explicitly transitioned', async () => {
    expect((await service.get(ent, date)).sites[0].visitor).toBe(40);
    expect(await total()).toMatchObject({
      marketingVisitor: 100,
      marketingCost: '1000',
    });
  });
  it('adds adjustment to GA, includes all three sites, and preserves unrelated fields', async () => {
    await patch([{ site: 'TPI', adjustment: 5 }]);
    expect(await total()).toMatchObject({
      marketingVisitor: 65,
      marketingCost: '1000',
      csCounseling: 8,
    });
  });
  it('refreshes GA without overwriting correction and replaces rather than accumulates', async () => {
    await patch([{ site: 'TPI', adjustment: 5 }]);
    await ds.query(
      `UPDATE amb_acm_dsh_site_visit SET svt_visitors=15 WHERE svt_site='TPI'`,
    );
    await patch([{ site: 'TPI', adjustment: 5 }], 1);
    expect((await total()).marketingVisitor).toBe(70);
    await patch([{ site: 'TPI', adjustment: null }], 2);
    expect((await total()).marketingVisitor).toBe(65);
  });
  it('preserves missing GA and distinguishes an observed zero', async () => {
    await ds.query(
      `DELETE FROM amb_acm_dsh_site_visit WHERE svt_site='SANTACROCE'`,
    );
    await patch([{ site: 'TPI', adjustment: 0 }]);
    expect(await total()).toMatchObject({
      marketingVisitor: null,
      marketingVisitorPartial: true,
      marketingVisitorKnownSubtotal: 30,
    });
    await ds.query(
      `INSERT INTO amb_acm_dsh_site_visit(ent_id,svt_date,svt_site,svt_visitors) VALUES($1,$2,'SANTACROCE',0)`,
      [ent, date],
    );
    expect((await total()).marketingVisitor).toBe(30);
  });
  it('cost-only save preserves visitors and carries forward legacy common cost', async () => {
    const day = await patch([
      {
        site: 'TPI',
        ads: [
          { medium: 'Google', amount: 150 },
          { medium: 'Naver', amount: 50 },
        ],
      },
    ]);
    expect(day.additive).toBe(false);
    expect(day.sites[0].effect).toBe(5);
    expect(await total()).toMatchObject({
      marketingVisitor: 100,
      marketingCost: '1100',
    });
  });
  it('edits and deletes ads without duplicates', async () => {
    const day = await patch([
      { site: 'TPI', ads: [{ medium: 'Google', amount: 200 }] },
    ]);
    const id = day.sites[0].ads[0].id!;
    await patch(
      [{ site: 'TPI', ads: [{ id, medium: 'Google', amount: 250 }] }],
      1,
    );
    expect((await total()).marketingCost).toBe('1150');
    await patch([{ site: 'TPI', ads: [] }], 2);
    expect((await total()).marketingCost).toBe('900');
    expect(
      (
        await ds.query(
          'SELECT * FROM amb_acm_dsh_ad_cost WHERE deleted_at IS NOT NULL',
        )
      ).length,
    ).toBe(1);
  });
  it('rejects stale writes atomically', async () => {
    await patch([{ site: 'TPI', adjustment: 5 }]);
    await expect(patch([{ site: 'TPI', adjustment: 7 }])).rejects.toThrow(
      'MARKETING_CHANGED',
    );
    expect((await total()).marketingVisitor).toBe(65);
  });
  it('isolates tenants and rejects foreign ad ids with rollback', async () => {
    const day = await patch([
      { site: 'TPI', ads: [{ medium: 'Google', amount: 2 }] },
    ]);
    await expect(
      patch(
        [
          {
            site: 'TRINITY',
            adjustment: 10,
            ads: [{ id: day.sites[0].ads[0].id!, medium: 'Bad', amount: 2 }],
          },
        ],
        1,
      ),
    ).rejects.toThrow('INVALID_AD_ROW');
    expect((await service.get(ent, date)).revision).toBe(1);
    expect((await service.get(other, date)).sites[0].ads).toHaveLength(0);
    await patch([{ site: 'TPI', adjustment: 99 }], 0, other);
    expect((await service.get(ent, date)).additive).toBe(false);
  });
  it('guards legacy marketing writes but allows unrelated CS writes', async () => {
    await patch([{ site: 'TPI', adjustment: 1, ads: [] }]);
    await expect(
      ds.transaction((m) => guardLegacyMarketing(m, ent, date, true, false)),
    ).rejects.toThrow('USE_MARKETING_INPUT');
    await expect(
      ds.transaction((m) => guardLegacyMarketing(m, ent, date, false, true)),
    ).rejects.toThrow('USE_MARKETING_INPUT');
    await ds.transaction((m) =>
      guardLegacyMarketing(m, ent, date, false, false),
    );
  });
  it('does not guess a negative legacy common cost', async () => {
    await ds.query('UPDATE amb_acm_dsh_daily_kpi SET dkp_marketing_cost=50');
    await expect(patch([{ site: 'TPI', ads: [] }])).rejects.toThrow(
      'LEGACY_COST_MISMATCH',
    );
    expect((await service.get(ent, date)).revision).toBe(0);
  });
  it('creates missing grid date and resolves site totals consistently', async () => {
    await patch([{ site: 'TPI', adjustment: 5 }]);
    const rows: Array<{ date: string; marketingVisitor?: number | null }> = [];
    await applyMarketingRows(ds, ent, date, date, rows, 'TPI');
    expect(rows[0].marketingVisitor).toBe(15);
  });
  it('rejects invalid nested input and invalid calendar dates', async () => {
    for (const ads of [
      null,
      [{ medium: 'x', amount: -1 }],
      [{ medium: 'x', amount: 1.5 }],
    ])
      expect(
        (
          await validate(
            plainToInstance(MarketingPatchDto, {
              expectedRevision: 0,
              sites: [{ site: 'TPI', ads }],
            }),
          )
        ).length,
      ).toBeGreaterThan(0);
    await expect(service.get(ent, '2026-02-30')).rejects.toThrow(
      'INVALID_DATE',
    );
  });
});
