import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PortalAccountService } from './portal-account.service';

jest.mock('bcrypt');

/** PLN-260708 — tenant-scoped portal login. */
describe('PortalAccountService.login (tenant scope)', () => {
  const mkSvc = (opts: {
    tenant?: { entId: string } | null;
    account?: any;
  }) => {
    const accounts = {
      findOne: jest.fn().mockResolvedValue(opts.account ?? null),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const tenants = {
      findOne: jest.fn().mockResolvedValue(opts.tenant ?? null),
    };
    const jwt = { sign: jest.fn().mockReturnValue('signed.jwt') };
    const svc = new PortalAccountService(
      accounts as any,
      tenants as any,
      jwt as any,
    );
    return { svc, accounts, tenants, jwt };
  };

  it('unknown tenant code → 401, does not look up the account', async () => {
    const { svc, accounts, tenants } = mkSvc({ tenant: null });
    await expect(svc.login('nope', 's7k3m9', 'pw')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(tenants.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'nope', status: 'ACTIVE' } }),
    );
    expect(accounts.findOne).not.toHaveBeenCalled();
  });

  it('scopes the account lookup by the resolved entId', async () => {
    const { svc, accounts } = mkSvc({ tenant: { entId: 'ent-1' }, account: null });
    await expect(svc.login('TRINITY', 's7k3m9', 'pw')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // login id resolved within the tenant, not globally
    expect(accounts.findOne).toHaveBeenCalledWith({
      where: { entId: 'ent-1', loginId: 's7k3m9', status: 'ACTIVE' },
    });
  });

  it('lowercases/trims the tenant code before lookup', async () => {
    const { svc, tenants } = mkSvc({ tenant: null });
    await svc.login('  TpI  ', 'x', 'y').catch(() => {});
    expect(tenants.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'tpi', status: 'ACTIVE' } }),
    );
  });

  it('succeeds for a matching account + password within the tenant', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const account = {
      id: 'pac-1',
      entId: 'ent-1',
      kind: 'STUDENT',
      refId: 'std-1',
      loginId: 's7k3m9',
      passwordHash: 'hash',
      mustChangePassword: true,
      status: 'ACTIVE',
      lockedAt: null,
    };
    const { svc, jwt } = mkSvc({ tenant: { entId: 'ent-1' }, account });
    const res = await svc.login('tpi', 's7k3m9', 'correct');
    expect(res.accessToken).toBe('signed.jwt');
    expect(res.mustChangePassword).toBe(true);
    expect(res.user).toMatchObject({ entId: 'ent-1', kind: 'STUDENT', refId: 'std-1' });
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ entId: 'ent-1', kind: 'STUDENT', refId: 'std-1' }),
    );
  });
});
