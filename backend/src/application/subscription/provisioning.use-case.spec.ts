import { Repository, DataSource, EntityManager } from 'typeorm';
import { ProvisioningUseCase } from './provisioning.use-case';
import { AcademyEntity } from '../../infrastructure/database/entities/academy.entity';
import { SubscriptionEventEntity } from '../../infrastructure/database/entities/subscription-event.entity';

function academyRepoStub(seed: AcademyEntity[] = []) {
  const rows = [...seed];
  let nextId = (rows[rows.length - 1]?.acdId ?? 0) + 1;
  const repo = {
    findOne: jest.fn(async (opts: { where?: Partial<AcademyEntity> }) => {
      const w = opts.where ?? {};
      return (
        rows.find((r) =>
          Object.entries(w).every(
            ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
          ),
        ) ?? null
      );
    }),
    update: jest.fn(async (id: number, patch: Partial<AcademyEntity>) => {
      const row = rows.find((r) => r.acdId === id);
      if (row) Object.assign(row, patch);
      return { affected: row ? 1 : 0 } as never;
    }),
    create: jest.fn((p: Partial<AcademyEntity>) => p as AcademyEntity),
    save: jest.fn(async (p: AcademyEntity) => {
      const row = { ...p, acdId: nextId++ } as AcademyEntity;
      rows.push(row);
      return row;
    }),
  };
  return { repo: repo as unknown as Repository<AcademyEntity>, rows };
}

function eventRepoStub() {
  const rows: SubscriptionEventEntity[] = [];
  const repo = {
    create: jest.fn((p: Partial<SubscriptionEventEntity>) => p as SubscriptionEventEntity),
    save: jest.fn(async (p: SubscriptionEventEntity) => {
      rows.push(p);
      return p;
    }),
  };
  return { repo: repo as unknown as Repository<SubscriptionEventEntity>, rows };
}

function dataSourceStub() {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const mgr = {
    getRepository: jest.fn(),
    query: jest.fn(async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      if (/SELECT rfp_id/i.test(sql)) return [{ rfp_id: 100 }];
      return [];
    }),
  } as unknown as EntityManager;
  const ds = {
    transaction: jest.fn(
      async (cb: (mgr: EntityManager) => Promise<unknown>) => cb(mgr),
    ),
  } as unknown as DataSource;
  return { ds, mgr, queries };
}

describe('ProvisioningUseCase', () => {
  const baseInput = {
    amaTenantId: 'AMA-T1',
    plan: 'pro',
    name: 'New Academy',
    eventNonce: 'n-1',
    eventAt: new Date('2026-04-01T00:00:00Z'),
    signature: 'sig',
    rawPayload: { eventType: 'SUBSCRIPTION_CREATED' },
  };

  it('creates a new academy and runs seed template', async () => {
    const { repo: aRepo, rows: aRows } = academyRepoStub();
    const { repo: eRepo, rows: eRows } = eventRepoStub();
    const { ds, mgr } = dataSourceStub();
    // Hook getRepository to return a save-capable academy repo bound to outer rows.
    (mgr.getRepository as jest.Mock).mockReturnValue(aRepo);

    const uc = new ProvisioningUseCase(aRepo, eRepo, ds);
    const result = await uc.provision(baseInput);

    expect(result.created).toBe(true);
    expect(result.acdId).toBeGreaterThan(0);
    expect(aRows).toHaveLength(1);
    expect(aRows[0].acdAmaTenantId).toBe('AMA-T1');
    expect(aRows[0].acdSubscriptionStatus).toBe('ACTIVE');
    expect(eRows).toHaveLength(1);
    expect(eRows[0].subEventType).toBe('SUBSCRIPTION_CREATED');
    expect(eRows[0].subNonce).toBe('n-1');
  });

  it('is idempotent for an existing tenant — re-activates without recreating', async () => {
    const existing = {
      acdId: 7,
      acdAmaTenantId: 'AMA-T1',
      acdSubscriptionStatus: 'CANCELED',
      acdProvisionedAt: new Date('2026-01-01'),
      acdCanceledAt: new Date('2026-03-01'),
      acdDeprovisionedAt: null,
    } as AcademyEntity;
    const { repo: aRepo, rows: aRows } = academyRepoStub([existing]);
    const { repo: eRepo, rows: eRows } = eventRepoStub();
    const { ds } = dataSourceStub();

    const uc = new ProvisioningUseCase(aRepo, eRepo, ds);
    const result = await uc.provision(baseInput);

    expect(result).toEqual({ acdId: 7, created: false });
    expect(aRows).toHaveLength(1);
    expect(aRows[0].acdSubscriptionStatus).toBe('ACTIVE');
    expect(aRows[0].acdCanceledAt).toBeNull();
    expect(aRows[0].acdSubscriptionPlan).toBe('pro');
    expect(eRows).toHaveLength(1);
    expect(ds.transaction).not.toHaveBeenCalled();
  });
});
