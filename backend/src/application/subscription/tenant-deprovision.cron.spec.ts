import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { TenantDeprovisionCron } from './tenant-deprovision.cron';
import { AcademyEntity } from '../../infrastructure/database/entities/academy.entity';
import { SubscriptionEventEntity } from '../../infrastructure/database/entities/subscription-event.entity';

const NOW = new Date('2026-04-30T03:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function academyRepoStub(seed: AcademyEntity[]) {
  const rows = [...seed];
  const repo = {
    find: jest.fn(async (opts: { where?: Record<string, unknown> }) => {
      const w = opts.where ?? {};
      const cutoff = (w as { acdCanceledAt?: { _value?: Date } }).acdCanceledAt;
      // FindOperator<Date> 인스턴스에서 cutoff date 추출
      const cutoffDate = cutoff && (cutoff as unknown as { value: Date }).value;
      return rows.filter(
        (r) =>
          r.acdSubscriptionStatus === w.acdSubscriptionStatus &&
          r.acdCanceledAt != null &&
          (cutoffDate ? r.acdCanceledAt < cutoffDate : true),
      );
    }),
    update: jest.fn(async (id: number, patch: Partial<AcademyEntity>) => {
      const row = rows.find((r) => r.acdId === id);
      if (row) Object.assign(row, patch);
      return { affected: row ? 1 : 0 } as never;
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

describe('TenantDeprovisionCron', () => {
  const config = { get: (_k: string, def?: number) => def } as unknown as ConfigService;

  it('deprovisions canceled tenants past 90-day grace', async () => {
    const old = {
      acdId: 1,
      acdAmaTenantId: 'T1',
      acdSubscriptionStatus: 'CANCELED',
      acdCanceledAt: new Date(NOW.getTime() - 100 * DAY),
      acdSubscriptionPlan: 'pro',
    } as AcademyEntity;
    const recent = {
      acdId: 2,
      acdAmaTenantId: 'T2',
      acdSubscriptionStatus: 'CANCELED',
      acdCanceledAt: new Date(NOW.getTime() - 30 * DAY),
      acdSubscriptionPlan: 'pro',
    } as AcademyEntity;
    const { repo: aRepo, rows: aRows } = academyRepoStub([old, recent]);
    const { repo: eRepo, rows: eRows } = eventRepoStub();
    const cron = new TenantDeprovisionCron(config, aRepo, eRepo);

    const r = await cron.sweep(NOW);
    expect(r.scanned).toBe(1);
    expect(r.deprovisioned).toBe(1);
    expect(aRows[0].acdSubscriptionStatus).toBe('DEPROVISIONED');
    expect(aRows[0].acdDeprovisionedAt).toEqual(NOW);
    expect(aRows[1].acdSubscriptionStatus).toBe('CANCELED');
    expect(eRows).toHaveLength(1);
    expect(eRows[0].subEventType).toBe('SUBSCRIPTION_DEPROVISIONED');
  });

  it('returns zero when nothing past grace', async () => {
    const recent = {
      acdId: 2,
      acdAmaTenantId: 'T2',
      acdSubscriptionStatus: 'CANCELED',
      acdCanceledAt: new Date(NOW.getTime() - 30 * DAY),
    } as AcademyEntity;
    const { repo: aRepo } = academyRepoStub([recent]);
    const { repo: eRepo, rows: eRows } = eventRepoStub();
    const cron = new TenantDeprovisionCron(config, aRepo, eRepo);
    const r = await cron.sweep(NOW);
    expect(r).toEqual({ scanned: 0, deprovisioned: 0 });
    expect(eRows).toHaveLength(0);
  });
});
