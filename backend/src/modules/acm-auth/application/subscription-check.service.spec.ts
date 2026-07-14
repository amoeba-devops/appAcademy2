import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmTenantTypeormEntity } from '../../acm-system/infrastructure/typeorm/acm-tenant.typeorm-entity';
import { AmaConfigTypeormEntity } from '../infrastructure/typeorm/ama-config.typeorm-entity';
import {
  IStgAppsSubscriptionClient,
  STG_APPS_SUBSCRIPTION_CLIENT,
  SubscriptionInfo,
} from '../infrastructure/stg-apps-subscription.client';
import { SubscriptionCheckService } from './subscription-check.service';

describe('SubscriptionCheckService', () => {
  let svc: SubscriptionCheckService;
  let findOne: jest.Mock;
  let update: jest.Mock;
  let amaConfigFindOne: jest.Mock;
  let check: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn();
    update = jest.fn().mockResolvedValue({});
    amaConfigFindOne = jest.fn().mockResolvedValue(null);
    check = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        SubscriptionCheckService,
        {
          provide: getRepositoryToken(AcmTenantTypeormEntity, ACM_DS),
          useValue: { findOne, update },
        },
        {
          provide: getRepositoryToken(AmaConfigTypeormEntity, ACM_DS),
          useValue: { findOne: amaConfigFindOne },
        },
        {
          provide: STG_APPS_SUBSCRIPTION_CLIENT,
          useValue: { checkSubscription: check } as IStgAppsSubscriptionClient,
        },
      ],
    }).compile();
    svc = mod.get(SubscriptionCheckService);
  });

  const fakeTenant = (
    overrides: Partial<AcmTenantTypeormEntity> = {},
  ): AcmTenantTypeormEntity =>
    ({
      entId: 'tenant-uuid-1',
      amaEntityId: 'ama-ent-1',
      subscriptionStatus: 'ACTIVE',
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as AcmTenantTypeormEntity;

  const info = (overrides: Partial<SubscriptionInfo> = {}): SubscriptionInfo => ({
    status: 'ACTIVE',
    plan: 'trinity-pro',
    expiresAt: null,
    ...overrides,
  });

  describe('happy path — live returns ACTIVE', () => {
    it('passes (not degraded) and refreshes cache', async () => {
      check.mockResolvedValue(info({ status: 'ACTIVE' }));
      findOne.mockResolvedValue(fakeTenant());
      const result = await svc.ensureActive('ama-ent-1');
      expect(result).toEqual({ degraded: false, status: 'ACTIVE' });
      expect(update).toHaveBeenCalledWith(
        { entId: 'tenant-uuid-1' },
        expect.objectContaining({ subscriptionStatus: 'ACTIVE' }),
      );
    });

    it('accepts TRIALING as a passing state', async () => {
      check.mockResolvedValue(info({ status: 'TRIALING' }));
      const result = await svc.ensureActive('ama-ent-1');
      expect(result.degraded).toBe(false);
      expect(result.status).toBe('TRIALING');
    });
  });

  describe('live denies — terminal failure (no fallback)', () => {
    it.each([
      ['SUSPENDED', 'SUBSCRIPTION_SUSPENDED'],
      ['CANCELED', 'SUBSCRIPTION_CANCELED'],
      ['DEPROVISIONED', 'SUBSCRIPTION_DEPROVISIONED'],
    ])('throws 403 SUBSCRIPTION_%s', async (status, code) => {
      check.mockResolvedValue(info({ status: status as any }));
      const err = await svc.ensureActive('ama-ent-1').catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((err as HttpException).getResponse()).toMatchObject({ code });
    });

    it('throws 403 NO_SUBSCRIPTION when status is NOT_SUBSCRIBED', async () => {
      check.mockResolvedValue(info({ status: 'NOT_SUBSCRIBED' }));
      const err = await svc.ensureActive('ama-ent-1').catch((e) => e);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'NO_SUBSCRIPTION',
      });
    });

    it('throws 403 NO_SUBSCRIPTION when live returns null (stg-apps 404)', async () => {
      check.mockResolvedValue(null);
      const err = await svc.ensureActive('ama-ent-1').catch((e) => e);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'NO_SUBSCRIPTION',
      });
    });

    it('does NOT consult cache on a live deny', async () => {
      check.mockResolvedValue(info({ status: 'SUSPENDED' }));
      await svc.ensureActive('ama-ent-1').catch(() => undefined);
      expect(findOne).not.toHaveBeenCalled();
    });
  });

  describe('live 5xx — cache fallback', () => {
    it('passes degraded when cache age ≤ 24h and ACTIVE', async () => {
      check.mockRejectedValue(new Error('stg-apps 5xx'));
      findOne.mockResolvedValue(
        fakeTenant({
          subscriptionStatus: 'ACTIVE',
          updatedAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
        }),
      );
      const result = await svc.ensureActive('ama-ent-1');
      expect(result).toEqual({ degraded: true, status: 'ACTIVE' });
    });

    it('throws 503 AMA_UNAVAILABLE when cache is stale (> 24h)', async () => {
      check.mockRejectedValue(new Error('timeout'));
      findOne.mockResolvedValue(
        fakeTenant({
          subscriptionStatus: 'ACTIVE',
          updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h ago
        }),
      );
      const err = await svc.ensureActive('ama-ent-1').catch((e) => e);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'AMA_UNAVAILABLE',
      });
    });

    it('throws 403 NO_TENANT when no row + live failed', async () => {
      check.mockRejectedValue(new Error('boom'));
      findOne.mockResolvedValue(null);
      const err = await svc.ensureActive('unknown-ent').catch((e) => e);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'NO_TENANT',
      });
    });

    it('throws 403 SUBSCRIPTION_<status> when cache shows non-active', async () => {
      check.mockRejectedValue(new Error('boom'));
      findOne.mockResolvedValue(
        fakeTenant({
          subscriptionStatus: 'SUSPENDED',
          updatedAt: new Date(Date.now() - 30 * 60 * 1000),
        }),
      );
      const err = await svc.ensureActive('ama-ent-1').catch((e) => e);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'SUBSCRIPTION_SUSPENDED',
      });
    });
  });

  describe('cache refresh resilience', () => {
    it('does not fail login if cache update throws', async () => {
      check.mockResolvedValue(info({ status: 'ACTIVE' }));
      findOne.mockResolvedValue(fakeTenant());
      update.mockRejectedValue(new Error('DB connection lost'));
      const result = await svc.ensureActive('ama-ent-1');
      expect(result.degraded).toBe(false);
    });
  });
});
