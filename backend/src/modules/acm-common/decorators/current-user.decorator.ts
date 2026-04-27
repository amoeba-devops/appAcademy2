import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AcmCurrentUser {
  id: string;
  entId: string;
  roles?: string[];
  email?: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AcmCurrentUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AcmCurrentUser }>();
    if (!req.user) throw new Error('No authenticated user on request');
    return req.user;
  },
);
