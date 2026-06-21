import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { RequirePasswordRotationGuard } from './require-password-rotation.guard';

function ctx(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RequirePasswordRotationGuard', () => {
  const guard = new RequirePasswordRotationGuard();

  it('blocks when mustChangePassword is true (PASSWORD_CHANGE_REQUIRED)', () => {
    expect(() => guard.canActivate(ctx({ id: 'u1', mustChangePassword: true }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows when mustChangePassword is false', () => {
    expect(guard.canActivate(ctx({ id: 'u1', mustChangePassword: false }))).toBe(true);
  });

  it('allows when flag is absent', () => {
    expect(guard.canActivate(ctx({ id: 'u1' }))).toBe(true);
  });
});
