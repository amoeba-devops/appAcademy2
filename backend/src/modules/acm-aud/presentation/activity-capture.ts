import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NestMiddleware,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { from, Observable, switchMap, tap } from 'rxjs';
import {
  AUDIT_META,
  type AuditMeta,
} from '../../acm-common/decorators/audit.decorator';
import { clientIp } from '../../acm-common/http/client-ip';
import { ActivityLabelService } from '../application/activity-label.service';
import {
  changedFields,
  createdId,
  decide,
  fileNameOf,
  isExcluded,
  resultOf,
  stripApi,
  type ActivityDecision,
} from '../application/activity-rules';
import { ActivityWriterService } from '../application/activity-writer.service';

const CTX = Symbol('acm.activity');

interface ActorLike {
  id?: string;
  entId?: string;
  name?: string;
  role?: string;
  kind?: string;
  loginId?: string;
}
interface Capture {
  decision: ActivityDecision;
  meta?: AuditMeta;
  /** GET without a hint: only recorded if the handler returned a file (safety net). */
  onlyIfFile?: boolean;
  isFile?: boolean;
  fields: string | null;
  label: Promise<string | null>;
}
type AuditedRequest = Request & { user?: ActorLike; [CTX]?: Capture | false };

/**
 * PLN-261022 — runs after guards: reads route hints, snapshots the target label *before* the
 * handler (so deletes keep the name) and picks up the created id from the response.
 */
@Injectable()
export class ActivityAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly labels: ActivityLabelService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<AuditedRequest>();
    const user = req.user;
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(
      AUDIT_META,
      [ctx.getHandler(), ctx.getClass()],
    );
    const routePattern =
      (req.route as { path?: string } | undefined)?.path ?? req.path;
    let decision = decide({
      method: req.method,
      routePattern,
      params: req.params ?? {},
      meta,
    });
    let onlyIfFile = false;
    if (
      !decision &&
      req.method === 'GET' &&
      !meta?.skip &&
      !isExcluded(routePattern)
    ) {
      const probe = decide({
        method: 'GET',
        routePattern,
        params: req.params ?? {},
        meta: { action: 'DOWNLOAD' },
      });
      if (probe) {
        decision = probe;
        onlyIfFile = true;
      }
    }
    if (!decision || !user?.entId) {
      req[CTX] = false;
      return next.handle();
    }
    const entId = user.entId;
    const capture: Capture = {
      decision,
      meta,
      onlyIfFile,
      fields:
        decision.action === 'CREATE' || decision.action === 'UPDATE'
          ? changedFields(req.body)
          : null,
      label: Promise.resolve(null),
    };
    req[CTX] = capture;
    const before =
      decision.action === 'CREATE' || onlyIfFile
        ? Promise.resolve(null)
        : this.labels.label(entId, decision.targetType, decision.targetId);
    capture.label = before;
    return from(before).pipe(
      switchMap(() => next.handle()),
      tap((body) => {
        capture.isFile = body instanceof StreamableFile;
        if (decision.action === 'CREATE' && !decision.targetId) {
          decision.targetId = createdId(body);
          capture.label = this.labels.label(
            entId,
            decision.targetType,
            decision.targetId,
          );
        }
      }),
    );
  }
}

/**
 * PLN-261022 — writes the row when the response finishes, so guard rejections (403, which run
 * before interceptors) and errors are recorded too.
 */
@Injectable()
export class ActivityCaptureMiddleware implements NestMiddleware {
  constructor(private readonly writer: ActivityWriterService) {}

  use(req: AuditedRequest, res: Response, next: NextFunction) {
    res.on('finish', () => {
      void this.finish(req, res);
    });
    next();
  }

  private async finish(req: AuditedRequest, res: Response) {
    const c = req[CTX];
    const user = req.user;
    if (c === false || !user?.entId) return;
    const status = res.statusCode;
    let decision: ActivityDecision | null;
    let label: string | null = null;
    let fields: string | null = null;
    if (c) {
      if (c.onlyIfFile && !(c.isFile && status < 400)) return;
      decision = c.decision;
      label = await c.label.catch(() => null);
      fields = c.fields;
      if (decision.action === 'DOWNLOAD')
        label = label ?? fileNameOf(res.getHeader('Content-Disposition'));
      if (c.meta?.download)
        decision = {
          ...decision,
          targetType: decision.targetType ?? c.meta.download,
        };
    } else {
      // Never reached the interceptor: rejected by a guard (or failed before it).
      if (status !== 401 && status !== 403) return;
      const routePattern = (req.route as { path?: string } | undefined)?.path;
      if (!routePattern) return;
      decision = decide({
        method: req.method,
        routePattern,
        params: req.params ?? {},
      });
      if (!decision) return;
    }
    await this.writer.write({
      entId: user.entId,
      userId: user.id ?? null,
      actorKind: decision.actorKind,
      actorName: user.name ?? user.loginId ?? null,
      actorRole: user.role ?? user.kind ?? null,
      action: decision.action,
      menu: decision.menu,
      targetType: decision.targetType,
      targetId: decision.targetId,
      targetLabel: label,
      fields,
      result: resultOf(status),
      method: req.method,
      path: stripApi(req.originalUrl ?? req.url).slice(0, 300),
      status,
      ip: clientIp(req) || null,
      userAgent: (req.headers['user-agent'] ?? '').slice(0, 500) || null,
      requestId: (res.getHeader('X-Request-Id') as string | undefined) ?? null,
    });
  }
}
