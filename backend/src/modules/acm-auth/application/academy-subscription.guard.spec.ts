import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmTenantTypeormEntity } from '../../acm-system/infrastructure/typeorm/acm-tenant.typeorm-entity';
import { AcademySubscriptionGuard } from './academy-subscription.guard';

describe('AcademySubscriptionGuard', () => {
  let guard: AcademySubscriptionGuard;
  let findOne: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        AcademySubscriptionGuard,
        {
          provide: getRepositoryToken(AcmTenantTypeormEntity, ACM_DS),
          useValue: { findOne },
        },
      ],
    }).compile();
    guard = mod.get(AcademySubscriptionGuard);
  });

  const fakeTenant = (
    overrides: Partial<AcmTenantTypeormEntity> = {},
  ): AcmTenantTypeormEntity =>
    ({
      entId: 'tenant-uuid-1',
      name: 'TPI',
      amaEntityId: 'ama-ent-1',
      status: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      ...overrides,
    }) as unknown as AcmTenantTypeormEntity;

  describe('ensureActive', () => {
    it('passes for ACTIVE subscription', async () => {
      findOne.mockResolvedValue(fakeTenant({ subscriptionStatus: 'ACTIVE' }));
      await expect(guard.ensureActive('ama-ent-1')).resolves.toBeUndefined();
    });

    it('passes for TRIALING subscription', async () => {
      findOne.mockResolvedValue(fakeTenant({ subscriptionStatus: 'TRIALING' }));
      await expect(guard.ensureActive('ama-ent-1')).resolves.toBeUndefined();
    });

    it('throws 403 NO_TENANT when the ent has no tenant row', async () => {
      findOne.mockResolvedValue(null);
      const err = await guard.ensureActive('unknown-ent').catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'NO_TENANT',
      });
    });

    it.each([
      ['SUSPENDED', 'SUBSCRIPTION_SUSPENDED'],
      ['CANCELED', 'SUBSCRIPTION_CANCELED'],
      ['DEPROVISIONED', 'SUBSCRIPTION_DEPROVISIONED'],
      ['EXPIRED', 'SUBSCRIPTION_EXPIRED'],
    ])('throws 403 SUBSCRIPTION_%s for status %s', async (status, expectedCode) => {
      findOne.mockResolvedValue(fakeTenant({ subscriptionStatus: status }));
      const err = await guard.ensureActive('ama-ent-1').catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: expectedCode,
        data: { entityId: 'ama-ent-1', status },
      });
    });

    it('queries by amaEntityId', async () => {
      findOne.mockResolvedValue(fakeTenant());
      await guard.ensureActive('ama-ent-1');
      expect(findOne).toHaveBeenCalledWith({
        where: { amaEntityId: 'ama-ent-1' },
      });
    });
  });
});
