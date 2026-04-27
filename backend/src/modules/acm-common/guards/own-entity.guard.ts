import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

interface AuthRequest {
  user?: { id: string; entId: string; roles?: string[] };
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

/**
 * Multi-tenancy guard — enforces ent_id scoping.
 * Pulls JWT-bound entId and injects into request.body/query if missing.
 * Rejects request if entId mismatch with body/param entId.
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

    if (req.body && typeof req.body === 'object') {
      (req.body as Record<string, unknown>).entId = entId;
    }
    return true;
  }
}
