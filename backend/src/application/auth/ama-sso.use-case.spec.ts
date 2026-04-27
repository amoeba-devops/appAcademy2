import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { AmaSsoUseCase } from './ama-sso.use-case';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';
import { UserAcademyEntity } from '../../infrastructure/database/entities/user-academy.entity';
import {
  AmaOidcService,
  AmaOidcUserInfo,
} from '../../infrastructure/external/ama/auth/interfaces/ama-oidc.interface';

/** Lightweight in-memory repo stub (only methods we use). */
function makeUserRepo(seed: UserEntity[] = []) {
  const rows = [...seed];
  let nextId = (rows[rows.length - 1]?.usrId ?? 0) + 1;
  const repo = {
    findOne: jest.fn(async (opts: { where?: Partial<UserEntity> }) => {
      const w = opts.where ?? {};
      return (
        rows.find((r) =>
          Object.entries(w).every(
            ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
          ),
        ) ?? null
      );
    }),
    update: jest.fn(async (id: number, patch: Partial<UserEntity>) => {
      const row = rows.find((r) => r.usrId === id);
      if (row) Object.assign(row, patch);
      return { affected: row ? 1 : 0 } as never;
    }),
    create: jest.fn((p: Partial<UserEntity>) => p as UserEntity),
    save: jest.fn(async (p: UserEntity) => {
      const row = { ...p, usrId: nextId++ } as UserEntity;
      rows.push(row);
      return row;
    }),
  };
  return { repo: repo as unknown as Repository<UserEntity>, rows };
}

function makeMemberRepo(seed: UserAcademyEntity[] = []) {
  const rows = [...seed];
  const repo = {
    find: jest.fn(async (opts: { where?: Partial<UserAcademyEntity> }) => {
      const w = opts.where ?? {};
      return rows.filter((r) =>
        Object.entries(w).every(
          ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
        ),
      );
    }),
  };
  return { repo: repo as unknown as Repository<UserAcademyEntity>, rows };
}

function fakeJwt(): JwtService {
  return {
    sign: jest.fn(() => 'jwt-token'),
  } as unknown as JwtService;
}

function fakeOidc(info: AmaOidcUserInfo): AmaOidcService {
  return {
    buildAuthorizeUrl: () => 'http://mock/authorize',
    exchangeCode: jest.fn(async () => ({
      accessToken: 'a',
      idToken: 'i',
      expiresIn: 3600,
      tokenType: 'Bearer' as const,
    })),
    fetchUserInfo: jest.fn(async () => info),
  };
}

describe('AmaSsoUseCase', () => {
  const userInfo: AmaOidcUserInfo = {
    sub: 'ama-user-A',
    email: 'a@x.com',
    name: 'Alice',
  };

  it('upsert creates new user when sub not found → nextStep=onboarding', async () => {
    const { repo: u, rows: uRows } = makeUserRepo([]);
    const { repo: m } = makeMemberRepo([]);
    const uc = new AmaSsoUseCase(fakeOidc(userInfo), u, m, fakeJwt());
    const res = await uc.upsertAndIssue(userInfo);
    expect(res.nextStep).toBe('onboarding');
    expect(res.activeAcademyId).toBeNull();
    expect(uRows).toHaveLength(1);
    expect(uRows[0].usrAmaUserId).toBe('ama-user-A');
    expect(uRows[0].usrPassword).toBeNull();
    expect(res.accessToken).toBe('jwt-token');
  });

  it('existing user with single membership → nextStep=dashboard, active=membership.acdId', async () => {
    const existing: UserEntity = {
      usrId: 7,
      acdId: null,
      usrActiveAcdId: null,
      usrEmail: 'a@x.com',
      usrAmaUserId: 'ama-user-A',
      usrPassword: null,
      usrName: 'Alice',
      usrRole: 'STAFF',
      usrStatus: 'ACTIVE',
      usrLastLoginAt: null,
      usrInvitedAt: null,
      usrAcceptedAt: null,
    } as UserEntity;
    const member: UserAcademyEntity = {
      uamId: 1,
      usrId: 7,
      acdId: 100,
      uamRole: 'ADMIN',
      uamStatus: 'ACTIVE',
    } as UserAcademyEntity;
    const { repo: u } = makeUserRepo([existing]);
    const { repo: m } = makeMemberRepo([member]);
    const uc = new AmaSsoUseCase(fakeOidc(userInfo), u, m, fakeJwt());
    const res = await uc.upsertAndIssue(userInfo);
    expect(res.nextStep).toBe('dashboard');
    expect(res.activeAcademyId).toBe(100);
    expect(res.user.role).toBe('ADMIN');
    expect(res.memberships).toHaveLength(1);
  });

  it('multi-membership → nextStep=select-tenant when prior active is invalid', async () => {
    const existing: UserEntity = {
      usrId: 8,
      acdId: 100,
      usrActiveAcdId: 999,
      usrEmail: 'a@x.com',
      usrAmaUserId: 'ama-user-A',
      usrPassword: null,
      usrName: 'Alice',
      usrRole: 'STAFF',
      usrStatus: 'ACTIVE',
      usrLastLoginAt: null,
      usrInvitedAt: null,
      usrAcceptedAt: null,
    } as UserEntity;
    const ms: UserAcademyEntity[] = [
      { uamId: 1, usrId: 8, acdId: 100, uamRole: 'ADMIN', uamStatus: 'ACTIVE' } as UserAcademyEntity,
      { uamId: 2, usrId: 8, acdId: 200, uamRole: 'STAFF', uamStatus: 'ACTIVE' } as UserAcademyEntity,
    ];
    const { repo: u } = makeUserRepo([existing]);
    const { repo: m } = makeMemberRepo(ms);
    const uc = new AmaSsoUseCase(fakeOidc(userInfo), u, m, fakeJwt());
    const res = await uc.upsertAndIssue(userInfo);
    expect(res.nextStep).toBe('select-tenant');
    expect(res.activeAcademyId).toBeNull();
  });

  it('multi-membership → keeps prior active if still valid', async () => {
    const existing: UserEntity = {
      usrId: 9,
      acdId: 200,
      usrActiveAcdId: 200,
      usrEmail: 'a@x.com',
      usrAmaUserId: 'ama-user-A',
      usrPassword: null,
      usrName: 'Alice',
      usrRole: 'STAFF',
      usrStatus: 'ACTIVE',
      usrLastLoginAt: null,
      usrInvitedAt: null,
      usrAcceptedAt: null,
    } as UserEntity;
    const ms: UserAcademyEntity[] = [
      { uamId: 1, usrId: 9, acdId: 100, uamRole: 'ADMIN', uamStatus: 'ACTIVE' } as UserAcademyEntity,
      { uamId: 2, usrId: 9, acdId: 200, uamRole: 'STAFF', uamStatus: 'ACTIVE' } as UserAcademyEntity,
    ];
    const { repo: u } = makeUserRepo([existing]);
    const { repo: m } = makeMemberRepo(ms);
    const uc = new AmaSsoUseCase(fakeOidc(userInfo), u, m, fakeJwt());
    const res = await uc.upsertAndIssue(userInfo);
    expect(res.nextStep).toBe('dashboard');
    expect(res.activeAcademyId).toBe(200);
    expect(res.user.role).toBe('STAFF');
  });
});
