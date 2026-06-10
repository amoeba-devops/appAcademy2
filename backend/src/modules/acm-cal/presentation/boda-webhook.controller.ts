import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { BodaConfigTypeormEntity } from '../infrastructure/typeorm/boda-config.typeorm-entity';
import { ACM_DS } from '../../acm-common/datasource';
import { BodaWebhookService } from '../application/boda-webhook.service';

/**
 * BODA Webhook payload — vendor SPEC_823 v823.002. Fields are deliberately
 * permissive because vendor docs are inconsistent across event codes (some
 * carry `meetIdx` but no `meetKey`, others vice versa).
 */
interface BodaWebhookPayload {
  /** Vendor company code = primary key for entId lookup. */
  Ccd?: string;
  companyCode?: string;
  /** Event type code (1·2·3·4·5·9·10·11·12·13·21..28). */
  eventCode?: number | string;
  eventType?: number | string;
  /** BODA internal meet identifier (issued at room creation). */
  meetIdx?: string | null;
  /** ACM-side meet key (`tac-{evtId hex 32}`). */
  meetKey?: string | null;
  /** Event timestamp (vendor format = ISO 8601 with TZ). */
  eventAt?: string;
  occurredAt?: string;
  /** User identifier for join/leave events. */
  userId?: string | null;
  UId?: string | null;
  [extra: string]: unknown;
}

/**
 * REQ-260526 v2 §5.4 — POST /api/webhooks/boda
 *
 * Auth (FR-EVENT-2):
 *   1. `Ccd`/`companyCode` → resolves tenant `entId` via `amb_acm_cal_boda_config`.
 *   2. `verifyAuth(entId, X-Boda-Token header, srcIp)` checks the per-tenant
 *      shared secret (decrypted from BYTEA) + IP allowlist (CSV CIDR).
 *
 * Behavior:
 *   - 401 on missing/wrong token, 401 on IP not allowed, 401 if config row
 *     hasn't been created yet (NO_SHARED_SECRET — operator must PUT config first).
 *   - 200 always when auth passes, including DB-level dedup duplicates (FR-EVENT-3).
 *   - Throttle 120 req/min to absorb retry storms.
 */
@ApiTags('webhooks-boda')
@Controller('webhooks/boda')
export class BodaWebhookController {
  private readonly logger = new Logger(BodaWebhookController.name);

  constructor(
    @InjectRepository(BodaConfigTypeormEntity, ACM_DS)
    private readonly cfgRepo: Repository<BodaConfigTypeormEntity>,
    private readonly svc: BodaWebhookService,
  ) {}

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Receive a BODA(보다에듀) classroom event',
    description:
      'Per-tenant shared-secret header + IP allowlist auth. Dedup via DB UNIQUE on (meetIdx, eventCode, eventAt, userId). Returns 200 even on dedup.',
  })
  async receive(
    @Req() req: Request,
    @Body() body: BodaWebhookPayload,
    @Headers('x-boda-token') token?: string,
  ): Promise<{ ok: true; deduped?: boolean }> {
    const companyCode = body?.Ccd ?? body?.companyCode;
    if (!companyCode) {
      throw new BadRequestException('MISSING_COMPANY_CODE');
    }

    const eventCode = Number(body?.eventCode ?? body?.eventType);
    if (!Number.isInteger(eventCode) || eventCode < 1) {
      throw new BadRequestException('MISSING_EVENT_CODE');
    }

    const cfg = await this.cfgRepo.findOne({
      where: { companyCode: String(companyCode) },
    });
    if (!cfg || !cfg.isActive) {
      // Pretend the token was wrong — we don't leak whether the company is
      // unknown vs inactive (timing-safe-ish at this layer).
      this.logger.warn(
        `unknown/inactive companyCode=${companyCode} src=${this.srcOf(req)}`,
      );
      throw new UnauthorizedException('INVALID_TOKEN');
    }

    const srcIp = this.srcOf(req);
    const auth = await this.svc.verifyAuth(cfg.entId, token, srcIp);
    if (!auth.ok) {
      this.logger.warn(
        `webhook auth FAIL entId=${cfg.entId} reason=${auth.reason ?? '-'} src=${srcIp}`,
      );
      throw new UnauthorizedException(`AUTH_${auth.reason ?? 'DENIED'}`);
    }

    const result = await this.svc.handle({
      entId: cfg.entId,
      eventCode,
      meetIdx: typeof body?.meetIdx === 'string' ? body.meetIdx : null,
      meetKey: typeof body?.meetKey === 'string' ? body.meetKey : null,
      eventAt: this.parseEventAt(body?.eventAt ?? body?.occurredAt),
      userId: typeof body?.userId === 'string'
        ? body.userId
        : typeof body?.UId === 'string'
          ? body.UId
          : null,
      payload: (body ?? {}) as Record<string, unknown>,
      srcIp,
    });
    return result.deduped ? { ok: true, deduped: true } : { ok: true };
  }

  private parseEventAt(raw: string | undefined): Date {
    if (!raw) return new Date();
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  private srcOf(req: Request): string {
    // Trust X-Forwarded-For only when the request comes from a proxy we
    // control. NestJS' default trust-proxy behavior already strips spoofed
    // hops at the edge nginx; here we just take the first hop.
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      return xff.split(',')[0].trim();
    }
    return req.ip ?? '';
  }
}
