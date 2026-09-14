import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AcmRole = 'ADMIN' | 'TEACHER' | 'STAFF' | 'APP_ADMIN' | 'PARENT';

export interface AcmCurrentUser {
  id: string;
  entId: string;
  role?: AcmRole;
  /** @deprecated use `role` */
  roles?: string[];
  /** 요구 260914G — 계정 인증 출처. AMA 연동 계정만 허용하는 동작에 쓴다. */
  authSource?: 'local' | 'ama';
  email?: string;
  name?: string;
  phone?: string | null;
  /** REQ-260621 — true while the user must rotate their password. */
  mustChangePassword?: boolean;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AcmCurrentUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AcmCurrentUser }>();
    if (!req.user) throw new Error('No authenticated user on request');
    return req.user;
  },
);
