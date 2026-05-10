import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

interface AuthRequest {
  user?: { id: string; entId: string; roles?: string[] };
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

/**
 * Multi-tenancy guard — enforces ent_id scoping.
 * Rejects request if a client-supplied body.entId does not match the JWT-bound entId.
 *
 * NOTE: We deliberately do NOT inject entId into req.body. The global
 * ValidationPipe runs with `whitelist: true` + `forbidNonWhitelisted: true`,
 * so any property not declared on the DTO causes a 400. Handlers must read
 * entId from `@CurrentUser()` (JWT) — never from the body.
 */
@Injectable()
export class OwnEntityGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const entId = req.user?.entId;
    if (!entId) throw new ForbiddenException('Missing entId in JWT');

    const bodyEntId = (req.body as { entId?: string } | undefined)?.entId;
    if (bodyEntId && bodyEntId !== entId) {
      throw new ForbiddenException('entId mismatch');
    }
    return true;
  }
}
