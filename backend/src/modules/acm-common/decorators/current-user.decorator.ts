import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AcmRole = 'ADMIN' | 'TEACHER' | 'STAFF';

export interface AcmCurrentUser {
  id: string;
  entId: string;
  role?: AcmRole;
  /** @deprecated use `role` */
  roles?: string[];
  email?: string;
  name?: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AcmCurrentUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AcmCurrentUser }>();
    if (!req.user) throw new Error('No authenticated user on request');
    return req.user;
  },
);
