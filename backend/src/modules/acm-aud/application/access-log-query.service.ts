import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ACCESS_EVENTS } from './aud.types';

export interface AccessLogFilter {
  from: string;
  to: string;
  kind?: string;
  q?: string;
  event?: string;
  result?: string;
  ip?: string;
}

export interface AccessLogRow {
  id: string;
  createdAt: string;
  actorKind: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  loginId: string | null;
  event: string;
  result: string;
  reason: string | null;
  method: string | null;
  ip: string | null;
  client: string | null;
  userAgent: string | null;
  byUserName: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;
export const ACCESS_PAGE_SIZE = 50;
export const ACCESS_EXPORT_LIMIT = 100_000;

/** REQ-261021B FR-L-4/5/7 — tenant-scoped access-log reads (dates are KST days). */
@Injectable()
export class AccessLogQueryService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  private where(entId: string, f: AccessLogFilter) {
    if (!ISO.test(f.from) || !ISO.test(f.to) || f.from > f.to)
      throw new BadRequestException('from/to must be YYYY-MM-DD and from ≤ to');
    if ((Date.parse(f.to) - Date.parse(f.from)) / 86_400_000 >= MAX_DAYS)
      throw new BadRequestException(`Range must be at most ${MAX_DAYS} days`);
    const params: unknown[] = [entId, f.from, f.to];
    const cond = [
      'l.ent_id = $1',
      `l.created_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Seoul')`,
      `l.created_at < (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')`,
    ];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      cond.push(sql.split('?').join(`$${params.length}`));
    };
    if (f.kind === 'CONSOLE' || f.kind === 'PORTAL')
      add('l.aal_actor_kind = ?', f.kind);
    if (f.event && (ACCESS_EVENTS as readonly string[]).includes(f.event))
      add('l.aal_event = ?', f.event);
    if (f.result === 'SUCCESS' || f.result === 'FAILURE')
      add('l.aal_result = ?', f.result);
    if (f.ip?.trim())
      add('l.aal_ip LIKE ?', `${f.ip.trim().replace(/[%_\\]/g, '\\$&')}%`);
    if (f.q?.trim())
      add(
        '(l.aal_actor_name ILIKE ? OR l.aal_login_id ILIKE ?)',
        `%${f.q.trim().replace(/[%_\\]/g, '\\$&')}%`,
      );
    return { sql: cond.join(' AND '), params };
  }

  private select(where: string) {
    return `SELECT l.aal_id::text id, l.created_at::text "createdAt", l.aal_actor_kind "actorKind",
                   l.aal_actor_id::text "actorId", l.aal_actor_name "actorName", l.aal_actor_role "actorRole",
                   l.aal_login_id "loginId", l.aal_event "event", l.aal_result "result", l.aal_reason "reason",
                   l.aal_method "method", l.aal_ip "ip", l.aal_client "client", l.aal_user_agent "userAgent",
                   b.usr_name "byUserName"
              FROM amb_acm_aud_access_log l
              LEFT JOIN amb_acm_user b ON b.usr_id = l.aal_by_user_id
             WHERE ${where}
             ORDER BY l.created_at DESC, l.aal_id DESC`;
  }

  async list(entId: string, f: AccessLogFilter, page = 1) {
    const w = this.where(entId, f);
    const params = w.params;
    const p = Math.max(1, Math.floor(page) || 1);
    const [rows, [{ total }]] = await Promise.all([
      this.ds.query<AccessLogRow[]>(
        `${this.select(w.sql)} LIMIT ${ACCESS_PAGE_SIZE} OFFSET ${(p - 1) * ACCESS_PAGE_SIZE}`,
        params,
      ),
      this.ds.query<{ total: number }[]>(
        `SELECT count(*)::int total FROM amb_acm_aud_access_log l WHERE ${w.sql}`,
        params,
      ),
    ]);
    return { rows, page: p, limit: ACCESS_PAGE_SIZE, total };
  }

  async exportRows(entId: string, f: AccessLogFilter): Promise<AccessLogRow[]> {
    const w = this.where(entId, f);
    return this.ds.query<AccessLogRow[]>(
      `${this.select(w.sql)} LIMIT ${ACCESS_EXPORT_LIMIT}`,
      w.params,
    );
  }

  async summary(entId: string) {
    const [row] = await this.ds.query<
      { todayLogins: number; todayFailures: number; lockedAccounts: number }[]
    >(
      `WITH today AS (SELECT (date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul') AS t)
       SELECT
        (SELECT count(*) FROM amb_acm_aud_access_log, today WHERE ent_id=$1 AND created_at >= today.t
           AND aal_event IN ('LOGIN','SSO_EXCHANGE') AND aal_result='SUCCESS')::int "todayLogins",
        (SELECT count(*) FROM amb_acm_aud_access_log, today WHERE ent_id=$1 AND created_at >= today.t
           AND aal_event IN ('LOGIN','SSO_EXCHANGE') AND aal_result='FAILURE')::int "todayFailures",
        ((SELECT count(*) FROM amb_acm_user WHERE ent_id=$1 AND usr_locked_at IS NOT NULL)
         + (SELECT count(*) FROM amb_acm_portal_account WHERE ent_id=$1 AND pac_locked_at IS NOT NULL)
         + (SELECT count(*) FROM amb_acm_aud_login_failure WHERE ent_id=$1 AND alf_locked_until > now()))::int "lockedAccounts"`,
      [entId],
    );
    const topIps = await this.ds.query<{ ip: string; failures: number }[]>(
      `SELECT aal_ip ip, count(*)::int failures FROM amb_acm_aud_access_log
        WHERE ent_id=$1 AND created_at >= now() - interval '24 hours' AND aal_result='FAILURE'
          AND aal_event IN ('LOGIN','SSO_EXCHANGE') AND aal_ip IS NOT NULL
        GROUP BY aal_ip ORDER BY failures DESC, ip LIMIT 3`,
      [entId],
    );
    return { ...row, topFailureIps: topIps };
  }

  /** Admin/permanent locks (account columns) + temporary locks (failure table). */
  async lockedAccounts(entId: string) {
    return this.ds.query<
      {
        kind: string;
        actorId: string | null;
        failureId: string | null;
        name: string | null;
        loginId: string | null;
        role: string | null;
        reason: 'ADMIN' | 'AUTO';
        lockedAt: string | null;
        lockedUntil: string | null;
      }[]
    >(
      `SELECT 'CONSOLE' kind, u.usr_id::text "actorId", NULL "failureId", u.usr_name name, u.usr_email "loginId",
              u.usr_role role, 'ADMIN' reason, u.usr_locked_at::text "lockedAt", NULL "lockedUntil"
         FROM amb_acm_user u WHERE u.ent_id=$1 AND u.usr_locked_at IS NOT NULL
       UNION ALL
       SELECT 'PORTAL', a.pac_id::text, NULL, NULL, a.pac_login_id, a.pac_kind, 'ADMIN', a.pac_locked_at::text, NULL
         FROM amb_acm_portal_account a WHERE a.ent_id=$1 AND a.pac_locked_at IS NOT NULL
       UNION ALL
       SELECT COALESCE(f.alf_actor_kind,'CONSOLE'), f.alf_actor_id::text, f.alf_id::text,
              COALESCE(u.usr_name, NULL), f.alf_login_id, COALESCE(u.usr_role, a.pac_kind), 'AUTO',
              f.alf_last_at::text, f.alf_locked_until::text
         FROM amb_acm_aud_login_failure f
         LEFT JOIN amb_acm_user u ON f.alf_actor_kind='CONSOLE' AND u.usr_id=f.alf_actor_id
         LEFT JOIN amb_acm_portal_account a ON f.alf_actor_kind='PORTAL' AND a.pac_id=f.alf_actor_id
        WHERE f.ent_id=$1 AND f.alf_locked_until > now() AND f.alf_key NOT LIKE 'IP:%'
       ORDER BY "lockedAt" DESC NULLS LAST`,
      [entId],
    );
  }
}
