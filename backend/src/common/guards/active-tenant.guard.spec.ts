import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ActiveTenantGuard } from './active-tenant.guard';
import { UserAcademyEntity } from '../../infrastructure/database/entities/user-academy.entity';

function ctxOf(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as import('@nestjs/common').ExecutionContext;
}

function repoWith(rows: UserAcademyEntity[]): Repository<UserAcademyEntity> {
  return {
    findOne: jest.fn(async (opts: { where?: Partial<UserAcademyEntity> }) => {
      const w = opts.where ?? {};
      return (
        rows.find((r) =>
          Object.entries(w).every(
            ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
          ),
        ) ?? null
      );
    }),
  } as unknown as Repository<UserAcademyEntity>;
}

const makeMember = (
  usrId: number,
  acdId: number,
  uamStatus = 'ACTIVE',
  uamRole = 'STAFF',
): UserAcademyEntity =>
  ({ uamId: usrId * 1000 + acdId, usrId, acdId, uamStatus, uamRole } as UserAcademyEntity);

describe('ActiveTenantGuard', () => {
  it('rejects when no user on request', async () => {
    const guard = new ActiveTenantGuard(repoWith([]));
    await expect(guard.canActivate(ctxOf({ headers: {} }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects when user has no academy id and no header', async () => {
    const guard = new ActiveTenantGuard(repoWith([]));
    const req = {
      headers: {},
      user: { userId: 1, academyId: null, activeAcademyId: null, role: 'STAFF', email: '', name: '' },
    };
    await expect(guard.canActivate(ctxOf(req))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when user is not a member of requested academy', async () => {
    const guard = new ActiveTenantGuard(repoWith([makeMember(1, 100)]));
    const req = {
      headers: { 'x-active-tenant': '999' },
      user: { userId: 1, academyId: 100, activeAcademyId: 100, role: 'STAFF', email: '', name: '' },
    };
    await expect(guard.canActivate(ctxOf(req))).rejects.toThrow('TENANT_MEMBERSHIP_REQUIRED');
  });

  it('accepts when user has matching ACTIVE membership and injects role', async () => {
    const guard = new ActiveTenantGuard(repoWith([makeMember(1, 100, 'ACTIVE', 'ADMIN')]));
    const req: Record<string, unknown> = {
      headers: {},
      user: { userId: 1, academyId: 100, activeAcademyId: 100, role: 'STAFF', email: '', name: '' },
    };
    await expect(guard.canActivate(ctxOf(req))).resolves.toBe(true);
    expect((req.user as { role: string }).role).toBe('ADMIN');
    expect((req.user as { activeAcademyId: number }).activeAcademyId).toBe(100);
  });

  it('header X-Active-Tenant overrides JWT activeAcademyId', async () => {
    const guard = new ActiveTenantGuard(
      repoWith([makeMember(1, 100), makeMember(1, 200, 'ACTIVE', 'ADMIN')]),
    );
    const req: Record<string, unknown> = {
      headers: { 'x-active-tenant': '200' },
      user: { userId: 1, academyId: 100, activeAcademyId: 100, role: 'STAFF', email: '', name: '' },
    };
    await expect(guard.canActivate(ctxOf(req))).resolves.toBe(true);
    expect((req.user as { academyId: number }).academyId).toBe(200);
    expect((req.user as { role: string }).role).toBe('ADMIN');
  });

  it('rejects SUSPENDED membership even if acdId matches', async () => {
    const guard = new ActiveTenantGuard(repoWith([makeMember(1, 100, 'SUSPENDED')]));
    const req = {
      headers: {},
      user: { userId: 1, academyId: 100, activeAcademyId: 100, role: 'STAFF', email: '', name: '' },
    };
    await expect(guard.canActivate(ctxOf(req))).rejects.toThrow('TENANT_MEMBERSHIP_REQUIRED');
  });
});
