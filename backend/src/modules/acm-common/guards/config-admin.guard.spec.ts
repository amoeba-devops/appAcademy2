import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { ConfigAdminGuard } from './config-admin.guard';

const context = (user?: object) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as ExecutionContext;
describe('ConfigAdminGuard', () => {
  const query = jest.fn();
  const guard = new ConfigAdminGuard({ query } as never);
  beforeEach(() => query.mockReset());
  it('does not treat ADMIN or APP_ADMIN as an implicit grant', async () => {
    query.mockResolvedValue([{ allowed: false }]);
    for (const role of ['ADMIN', 'APP_ADMIN']) {
      await expect(
        guard.canActivate(context({ id: 'user', entId: 'tenant', role })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
  it('scopes grants to the current tenant/user and rechecks after revocation', async () => {
    query
      .mockResolvedValueOnce([{ allowed: true }])
      .mockResolvedValueOnce([{ allowed: false }]);
    const request = context({ id: 'user', entId: 'tenant' });
    await expect(guard.canActivate(request)).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("u.usr_status='ACTIVE'"),
      ['tenant', 'user'],
    );
    await expect(guard.canActivate(request)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('denies missing identity without a database read', async () => {
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(query).not.toHaveBeenCalled();
  });
  it('never fails open when the permission store fails', async () => {
    query.mockRejectedValue(new Error('database unavailable'));
    await expect(
      guard.canActivate(context({ id: 'user', entId: 'tenant' })),
    ).rejects.toThrow('database unavailable');
  });
});
