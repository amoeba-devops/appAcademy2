import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PortalAuthUser } from '../application/portal-account.service';

/** PLN-260706 — injects the authenticated portal account (student/parent/teacher). */
export const PortalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PortalAuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as PortalAuthUser;
  },
);
