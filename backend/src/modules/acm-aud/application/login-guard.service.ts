import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { currentRequestMeta } from '../../acm-common/http/request-meta';
import { AccessLogService } from './access-log.service';
import { AuditPolicyService } from './audit-policy.service';
import {
  AUD_SYSTEM_ENT,
  type AccessActor,
  type AccessMethod,
} from './aud.types';

/** Consecutive account failures reset after this much quiet time. */
const ACCOUNT_RESET_HOURS = 24;

export interface LoginAttempt {
  /** Tenant whose policy applies (system tenant when the account is unknown). */
  policyEntId: string;
  /** Stable key: `C:<email>` (console) or `P:<entId>:<loginId>` (portal). */
  accountKey: string;
  actor: AccessActor;
  method: AccessMethod;
}

export function consoleAccountKey(email: string): string {
  return `C:${email.trim().toLowerCase()}`;
}
export function portalAccountKey(entId: string, loginId: string): string {
  return `P:${entId}:${loginId.trim().toLowerCase()}`;
}

interface FailureRow {
  count: number;
  lockedUntil: string | null;
}

/**
 * REQ-261021B FR-C-3 — DB-backed login failure lockout shared by console, portal and SSO.
 * Replaces the per-process in-memory counter (lost on restart).
 */
@Injectable()
export class LoginGuardService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly policies: AuditPolicyService,
    private readonly log: AccessLogService,
  ) {}

  /** Throws 429 when the account is temporarily locked or the client IP is blocked. */
  async assertAllowed(a: LoginAttempt): Promise<void> {
    const ip = currentRequestMeta().ip;
    const rows = await this.ds.query<{ key: string; lockedUntil: string }[]>(
      `SELECT alf_key "key", alf_locked_until::text "lockedUntil" FROM amb_acm_aud_login_failure
        WHERE alf_key = ANY($1::text[]) AND alf_locked_until > now()`,
      [[a.accountKey, ...(ip ? [`IP:${ip}`] : [])]],
    );
    const ipRow = rows.find((r) => r.key.startsWith('IP:'));
    const accRow = rows.find((r) => !r.key.startsWith('IP:'));
    if (ipRow) {
      await this.log.record({
        actor: a.actor,
        event: 'LOGIN',
        result: 'FAILURE',
        reason: 'IP_BLOCKED',
        method: a.method,
      });
      throw tooMany('IP_TEMP_BLOCKED', ipRow.lockedUntil);
    }
    if (accRow) {
      await this.log.record({
        actor: a.actor,
        event: 'LOGIN',
        result: 'FAILURE',
        reason: 'TEMP_LOCKED',
        method: a.method,
      });
      throw tooMany('ACCOUNT_TEMP_LOCKED', accRow.lockedUntil);
    }
  }

  /**
   * Count a failed attempt (account + IP). When a limit is reached the lock starts now and
   * a LOCKED / IP_BLOCKED record is written. Returns the account lock end (null = not locked).
   */
  async onFailure(
    a: LoginAttempt,
  ): Promise<{ lockedUntil: string | null; permanent: boolean }> {
    const p = await this.policies.get(a.policyEntId);
    const ip = currentRequestMeta().ip;
    const acc = await this.bump(
      a.accountKey,
      a.actor.entId,
      a.actor,
      ACCOUNT_RESET_HOURS * 60,
    );
    let lockedUntil: string | null = null;
    let permanent = false;
    if (acc.count >= p.failMax && !acc.lockedUntil) {
      if (p.lockMinutes === 0 && a.actor.id) {
        permanent = true;
        await this.lockAccountPermanently(a.actor);
        await this.reset(a.accountKey);
      } else {
        lockedUntil = await this.lock(a.accountKey, Math.max(p.lockMinutes, 1));
      }
      await this.log.record({
        actor: a.actor,
        event: 'LOCKED',
        result: 'SUCCESS',
        reason: 'AUTO',
        method: a.method,
      });
    }
    if (ip) {
      const ipKey = `IP:${ip}`;
      const r = await this.bump(ipKey, AUD_SYSTEM_ENT, null, p.ipWindowMinutes);
      if (r.count >= p.ipFailMax && !r.lockedUntil) {
        await this.lock(ipKey, p.ipBlockMinutes);
        await this.log.record({
          actor: a.actor,
          event: 'IP_BLOCKED',
          result: 'SUCCESS',
          reason: 'AUTO',
          method: a.method,
        });
      }
    }
    return { lockedUntil, permanent };
  }

  async onSuccess(accountKey: string): Promise<void> {
    await this.reset(accountKey);
  }

  async reset(key: string): Promise<void> {
    await this.ds.query(
      `DELETE FROM amb_acm_aud_login_failure WHERE alf_key = $1`,
      [key],
    );
  }

  /** Atomic upsert; restarts the window when it expired or a previous lock ended. */
  private async bump(
    key: string,
    entId: string,
    actor: AccessActor | null,
    windowMinutes: number,
  ): Promise<FailureRow> {
    const res = await this.ds.query(
      `INSERT INTO amb_acm_aud_login_failure AS f
         (ent_id, alf_key, alf_actor_kind, alf_actor_id, alf_login_id, alf_count, alf_first_at, alf_last_at)
       VALUES ($1, $2, $3, $4, $5, 1, now(), now())
       ON CONFLICT (alf_key) DO UPDATE SET
         alf_count = CASE WHEN f.alf_last_at < now() - make_interval(mins => $6)
                            OR (f.alf_first_at < now() - make_interval(mins => $6) AND f.alf_key LIKE 'IP:%')
                            OR f.alf_locked_until <= now()
                          THEN 1 ELSE f.alf_count + 1 END,
         alf_first_at = CASE WHEN f.alf_last_at < now() - make_interval(mins => $6)
                               OR (f.alf_first_at < now() - make_interval(mins => $6) AND f.alf_key LIKE 'IP:%')
                               OR f.alf_locked_until <= now()
                             THEN now() ELSE f.alf_first_at END,
         alf_locked_until = CASE WHEN f.alf_locked_until <= now() THEN NULL ELSE f.alf_locked_until END,
         alf_actor_id = COALESCE(EXCLUDED.alf_actor_id, f.alf_actor_id),
         alf_last_at = now()
       RETURNING alf_count "count", alf_locked_until::text "lockedUntil"`,
      [
        entId,
        key,
        actor?.kind ?? null,
        actor?.id ?? null,
        actor?.loginId ?? null,
        windowMinutes,
      ],
    );
    return firstRow<FailureRow>(res) ?? { count: 1, lockedUntil: null };
  }

  private async lock(key: string, minutes: number): Promise<string> {
    const res = await this.ds.query(
      `UPDATE amb_acm_aud_login_failure SET alf_locked_until = now() + make_interval(mins => $2)
        WHERE alf_key = $1 RETURNING alf_locked_until::text "lockedUntil"`,
      [key, minutes],
    );
    return (
      firstRow<{ lockedUntil: string }>(res)?.lockedUntil ??
      new Date().toISOString()
    );
  }

  private async lockAccountPermanently(actor: AccessActor): Promise<void> {
    if (actor.kind === 'CONSOLE')
      await this.ds.query(
        `UPDATE amb_acm_user SET usr_locked_at = now() WHERE usr_id = $1 AND usr_locked_at IS NULL`,
        [actor.id],
      );
    else
      await this.ds.query(
        `UPDATE amb_acm_portal_account SET pac_locked_at = now() WHERE pac_id = $1 AND pac_locked_at IS NULL`,
        [actor.id],
      );
  }
}

/** ds.query returns rows for INSERT … RETURNING but [rows, count] for UPDATE … RETURNING. */
function firstRow<T>(res: unknown): T | undefined {
  if (!Array.isArray(res)) return undefined;
  const head: unknown = res[0];
  return (Array.isArray(head) ? head[0] : head) as T | undefined;
}

export function tooMany(
  code: 'ACCOUNT_TEMP_LOCKED' | 'IP_TEMP_BLOCKED',
  retryAt: string,
): HttpException {
  return new HttpException(
    {
      code,
      message: 'Too many failed attempts. Try again later.',
      details: { retryAt: new Date(retryAt).toISOString() },
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
