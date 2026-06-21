import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AcmCurrentUser } from '../decorators/current-user.decorator';

/**
 * REQ-260621 — blocks privileged actions while the authenticated user still
 * carries a forced-rotation flag (`mustChangePassword`). Apply to high-value
 * surfaces (e.g. /acm/system/*) so a seeded/temporary credential cannot be used
 * to perform admin actions until the password is rotated via
 * POST /acm/auth/change-password (which is NOT guarded by this).
 */
@Injectable()
export class RequirePasswordRotationGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user?: AcmCurrentUser }>();
    if (req.user?.mustChangePassword) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Password must be changed before performing this action',
      });
    }
    return true;
  }
}
