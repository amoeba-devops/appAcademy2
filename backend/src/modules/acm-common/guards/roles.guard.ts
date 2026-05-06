import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACM_ROLES_KEY } from '../decorators/roles.decorator';
import type { AcmCurrentUser, AcmRole } from '../decorators/current-user.decorator';

/**
 * Allows the request only if the authenticated user's role is in the @Roles() list.
 * If no @Roles() metadata is present, the guard is a no-op.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AcmRole[] | undefined>(
      ACM_ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: AcmCurrentUser }>();
    const role = req.user?.role;
    if (!role || !required.includes(role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
