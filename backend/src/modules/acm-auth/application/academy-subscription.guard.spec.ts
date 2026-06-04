import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AcademyEntity } from '../../../infrastructure/database/entities/academy.entity';
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
          provide: getRepositoryToken(AcademyEntity),
          useValue: { findOne },
        },
      ],
    }).compile();
    guard = mod.get(AcademySubscriptionGuard);
  });

  const fakeAcademy = (overrides: Partial<AcademyEntity> = {}): AcademyEntity =>
    ({
      acdId: 1,
      acdName: 'TPI',
      acdAmaTenantId: 'ama-ent-1',
      acdStatus: 'ACTIVE',
      acdSubscriptionStatus: 'ACTIVE',
      ...overrides,
    }) as unknown as AcademyEntity;

  describe('ensureActive', () => {
    it('passes for ACTIVE subscription', async () => {
      findOne.mockResolvedValue(fakeAcademy({ acdSubscriptionStatus: 'ACTIVE' }));
      await expect(guard.ensureActive('ama-ent-1')).resolves.toBeUndefined();
    });

    it('passes for TRIALING subscription', async () => {
      findOne.mockResolvedValue(fakeAcademy({ acdSubscriptionStatus: 'TRIALING' }));
      await expect(guard.ensureActive('ama-ent-1')).resolves.toBeUndefined();
    });

    it('throws 403 NO_ACADEMY when tenant has no academy row', async () => {
      findOne.mockResolvedValue(null);
      const err = await guard.ensureActive('unknown-ent').catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'NO_ACADEMY',
      });
    });

    it.each([
      ['SUSPENDED', 'SUBSCRIPTION_SUSPENDED'],
      ['CANCELED', 'SUBSCRIPTION_CANCELED'],
      ['DEPROVISIONED', 'SUBSCRIPTION_DEPROVISIONED'],
      ['EXPIRED', 'SUBSCRIPTION_EXPIRED'],
    ])('throws 403 SUBSCRIPTION_%s for status %s', async (status, expectedCode) => {
      findOne.mockResolvedValue(
        fakeAcademy({ acdSubscriptionStatus: status }),
      );
      const err = await guard.ensureActive('ama-ent-1').catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: expectedCode,
        data: { entityId: 'ama-ent-1', status },
      });
    });

    it('queries by acdAmaTenantId (not acd_id)', async () => {
      findOne.mockResolvedValue(fakeAcademy());
      await guard.ensureActive('ama-ent-1');
      expect(findOne).toHaveBeenCalledWith({
        where: { acdAmaTenantId: 'ama-ent-1' },
      });
    });
  });
});
