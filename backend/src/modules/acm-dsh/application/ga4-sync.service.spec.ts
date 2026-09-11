import { Ga4SyncService } from './ga4-sync.service';
import type { Ga4DataClient } from '../../acm-common/ga4/ga4-data.client';
import type { Ga4ConfigService } from '../../acm-system/application/ga4-config.service';
import type { DailyKpiService } from './daily-kpi.service';
import type { Repository } from 'typeorm';
import type { SiteVisitTypeormEntity } from '../infrastructure/typeorm/site-visit.typeorm-entity';

/** PLN-260912 — stream→site mapping, idempotent upsert, recompute per day, failure bookkeeping. */
describe('Ga4SyncService', () => {
  const ENT = '00000000-0000-0000-0000-000000000001';
  let repo: {
    findOne: jest.Mock;
    update: jest.Mock;
    insert: jest.Mock;
    find: jest.Mock;
  };
  let ga4: { runReport: jest.Mock };
  let config: {
    getSyncConfig: jest.Mock;
    recordSyncResult: jest.Mock;
    listActiveEntIds: jest.Mock;
  };
  let kpi: { recomputeDay: jest.Mock };
  let svc: Ga4SyncService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      insert: jest.fn(),
      find: jest.fn(),
    };
    ga4 = { runReport: jest.fn() };
    config = {
      getSyncConfig: jest.fn().mockResolvedValue({
        propertyId: '123',
        streamToSite: { '111': 'TPI', '222': 'TRINITY' },
        metric: 'activeUsers',
        key: { client_email: 'x@y', private_key: 'k' },
      }),
      recordSyncResult: jest.fn(),
      listActiveEntIds: jest.fn().mockResolvedValue([ENT]),
    };
    kpi = { recomputeDay: jest.fn() };
    svc = new Ga4SyncService(
      repo as unknown as Repository<SiteVisitTypeormEntity>,
      ga4 as unknown as Ga4DataClient,
      config as unknown as Ga4ConfigService,
      kpi as unknown as DailyKpiService,
    );
  });

  it('maps streams to sites, inserts new rows, updates existing, skips unmapped, recomputes each day', async () => {
    ga4.runReport.mockResolvedValue([
      {
        date: '2026-09-10',
        streamId: '111',
        metrics: { activeUsers: 115, sessions: 120, screenPageViews: 131 },
      },
      {
        date: '2026-09-10',
        streamId: '222',
        metrics: { activeUsers: 90, sessions: 95, screenPageViews: 100 },
      },
      {
        date: '2026-09-11',
        streamId: '999',
        metrics: { activeUsers: 5, sessions: 5, screenPageViews: 5 },
      },
    ]);
    repo.findOne.mockImplementation(async ({ where }) =>
      where.site === 'TRINITY' ? { id: 'existing' } : null,
    );

    const r = await svc.syncRange(ENT, '2026-09-10', '2026-09-11');

    expect(ga4.runReport).toHaveBeenCalledWith(expect.anything(), {
      propertyId: '123',
      startDate: '2026-09-10',
      endDate: '2026-09-11',
      metrics: ['activeUsers', 'sessions', 'screenPageViews'],
    });
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        entId: ENT,
        site: 'TPI',
        date: '2026-09-10',
        visitors: 115,
        source: 'GA4',
      }),
    );
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'existing' },
      expect.objectContaining({ visitors: 90 }),
    );
    expect(r).toMatchObject({
      rowsFetched: 3,
      rowsUpserted: 2,
      unmappedStreams: ['999'],
      daysRecomputed: 2,
    });
    expect(kpi.recomputeDay).toHaveBeenCalledTimes(2);
    expect(kpi.recomputeDay).toHaveBeenCalledWith(
      ENT,
      '2026-09-10',
      'ga4_sync',
    );
    expect(kpi.recomputeDay).toHaveBeenCalledWith(
      ENT,
      '2026-09-11',
      'ga4_sync',
    );
    expect(config.recordSyncResult).toHaveBeenCalledWith(ENT, 'SUCCESS');
  });

  it('throws GA4_CONFIG_NOT_SET when the tenant has no active config', async () => {
    config.getSyncConfig.mockResolvedValue(null);
    await expect(
      svc.syncRange(ENT, '2026-09-10', '2026-09-10'),
    ).rejects.toThrow('GA4_CONFIG_NOT_SET');
    expect(ga4.runReport).not.toHaveBeenCalled();
  });

  it('records FAILED with the error message when the API call fails', async () => {
    ga4.runReport.mockRejectedValue(new Error('GA4_REPORT_FAILED 403 denied'));
    await expect(
      svc.syncRange(ENT, '2026-09-10', '2026-09-10'),
    ).rejects.toThrow('403');
    expect(config.recordSyncResult).toHaveBeenCalledWith(
      ENT,
      'FAILED',
      'GA4_REPORT_FAILED 403 denied',
    );
    expect(kpi.recomputeDay).not.toHaveBeenCalled();
  });

  it('runNightly isolates per-tenant failures', async () => {
    config.listActiveEntIds.mockResolvedValue([ENT, 'ent-2']);
    config.getSyncConfig.mockImplementation(async (id: string) =>
      id === ENT
        ? {
            propertyId: '1',
            streamToSite: { '1': 'TPI' },
            metric: 'activeUsers',
            key: {},
          }
        : null,
    );
    ga4.runReport.mockResolvedValue([]);
    const r = await svc.runNightly();
    expect(r).toEqual({ tenants: 2, failed: 1 });
  });

  it('defaultWindow is D-3..D-1', () => {
    const { from, to } = svc.defaultWindow();
    const diff =
      (new Date(`${to}T00:00:00Z`).getTime() -
        new Date(`${from}T00:00:00Z`).getTime()) /
      86400000;
    expect(diff).toBe(2);
  });
});
