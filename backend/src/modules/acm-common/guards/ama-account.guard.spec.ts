import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AmaAccountGuard } from './ama-account.guard';
import type { AcmCurrentUser } from '../decorators/current-user.decorator';

/**
 * 요구 260914G — 상담 삭제·복구는 AMA 연동 계정만.
 * 판정은 **계정 기준**(auth_source='ama')이며 역할은 보지 않는다.
 */
describe('AmaAccountGuard', () => {
  const guard = new AmaAccountGuard();
  const ctx = (user?: Partial<AcmCurrentUser>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it('allows an AMA-linked account', () => {
    expect(guard.canActivate(ctx({ authSource: 'ama', role: 'STAFF' }))).toBe(
      true,
    );
  });

  it('rejects a local account even when it is ADMIN', () => {
    expect(() => guard.canActivate(ctx({ authSource: 'local', role: 'ADMIN' })))
      .toThrow(ForbiddenException);
  });

  it('rejects when authSource is missing (old token) or unauthenticated', () => {
    expect(() => guard.canActivate(ctx({ role: 'ADMIN' }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});
