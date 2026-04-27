import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LifecycleUseCase } from './lifecycle.use-case';
import { AcademyEntity } from '../../infrastructure/database/entities/academy.entity';
import { SubscriptionEventEntity } from '../../infrastructure/database/entities/subscription-event.entity';

function academyRepoStub(seed: AcademyEntity[] = []) {
  const rows = [...seed];
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

const baseAcademy = (over: Partial<AcademyEntity> = {}) =>
  ({
    acdId: 1,
    acdAmaTenantId: 'T-A',
    acdSubscriptionStatus: 'ACTIVE',
    acdSubscriptionPlan: 'starter',
    acdCanceledAt: null,
    acdDeprovisionedAt: null,
    ...over,
  }) as AcademyEntity;

describe('LifecycleUseCase', () => {
  const eventAt = new Date('2026-04-01T00:00:00Z');
  const baseEvt = {
    amaTenantId: 'T-A',
    eventNonce: 'n',
    eventAt,
    signature: 'sig',
    rawPayload: {},
  };

  it('throws NotFound for unknown tenant', async () => {
    const { repo: aRepo } = academyRepoStub();
    const { repo: eRepo } = eventRepoStub();
    const uc = new LifecycleUseCase(aRepo, eRepo);
    await expect(
      uc.apply({ ...baseEvt, action: 'SUSPEND' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SUSPEND sets subscription_status=SUSPENDED', async () => {
    const { repo: aRepo, rows: aRows } = academyRepoStub([baseAcademy()]);
    const { repo: eRepo, rows: eRows } = eventRepoStub();
    const uc = new LifecycleUseCase(aRepo, eRepo);
    await uc.apply({ ...baseEvt, action: 'SUSPEND' });
    expect(aRows[0].acdSubscriptionStatus).toBe('SUSPENDED');
    expect(eRows[0].subEventType).toBe('SUBSCRIPTION_SUSPENDED');
  });

  it('CANCEL sets canceled_at and status', async () => {
    const { repo: aRepo, rows: aRows } = academyRepoStub([baseAcademy()]);
    const { repo: eRepo } = eventRepoStub();
    const uc = new LifecycleUseCase(aRepo, eRepo);
    await uc.apply({ ...baseEvt, action: 'CANCEL' });
    expect(aRows[0].acdSubscriptionStatus).toBe('CANCELED');
    expect(aRows[0].acdCanceledAt).toEqual(eventAt);
  });

  it('RESUME clears canceled_at and reactivates', async () => {
    const { repo: aRepo, rows: aRows } = academyRepoStub([
      baseAcademy({
        acdSubscriptionStatus: 'CANCELED',
        acdCanceledAt: new Date('2026-03-01'),
      }),
    ]);
    const { repo: eRepo } = eventRepoStub();
    const uc = new LifecycleUseCase(aRepo, eRepo);
    await uc.apply({ ...baseEvt, action: 'RESUME' });
    expect(aRows[0].acdSubscriptionStatus).toBe('ACTIVE');
    expect(aRows[0].acdCanceledAt).toBeNull();
  });

  it('DEPROVISION sets deprovisioned_at', async () => {
    const { repo: aRepo, rows: aRows } = academyRepoStub([baseAcademy()]);
    const { repo: eRepo } = eventRepoStub();
    const uc = new LifecycleUseCase(aRepo, eRepo);
    await uc.apply({ ...baseEvt, action: 'DEPROVISION' });
    expect(aRows[0].acdSubscriptionStatus).toBe('DEPROVISIONED');
    expect(aRows[0].acdDeprovisionedAt).toEqual(eventAt);
  });

  it('PLAN_CHANGED updates plan only', async () => {
    const { repo: aRepo, rows: aRows } = academyRepoStub([baseAcademy()]);
    const { repo: eRepo } = eventRepoStub();
    const uc = new LifecycleUseCase(aRepo, eRepo);
    await uc.apply({ ...baseEvt, action: 'PLAN_CHANGED', plan: 'enterprise' });
    expect(aRows[0].acdSubscriptionStatus).toBe('ACTIVE');
    expect(aRows[0].acdSubscriptionPlan).toBe('enterprise');
  });
});
