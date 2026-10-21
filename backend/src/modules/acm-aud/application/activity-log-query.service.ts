import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';

export interface ActivityLogFilter {
  from: string;
  to: string;
  q?: string;
  action?: string;
  menu?: string;
  target?: string;
  targetType?: string;
  targetId?: string;
  result?: string;
  ip?: string;
}

export interface ActivityLogRow {
  id: string;
  createdAt: string;
  actorKind: string | null;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  menu: string | null;
  targetType: string;
  targetId: string;
  targetLabel: string | null;
  fields: string | null;
  result: string | null;
  method: string | null;
  path: string | null;
  status: number | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  reason: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;
const ACTIONS = [
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'DOWNLOAD',
  'EXPORT',
  'DECRYPT',
];
export const ACTIVITY_PAGE_SIZE = 50;
export const ACTIVITY_EXPORT_LIMIT = 100_000;
const like = (v: string) => `%${v.trim().replace(/[%_\\]/g, '\\$&')}%`;

/** PLN-261022 — tenant-scoped activity-log reads (dates are KST days). */
@Injectable()
export class ActivityLogQueryService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  private where(entId: string, f: ActivityLogFilter) {
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
    if (f.action && ACTIONS.includes(f.action))
      add('l.adl_action = ?', f.action);
    if (f.menu?.trim()) add('l.adl_menu = ?', f.menu.trim().slice(0, 30));
    if (f.result === 'SUCCESS')
      cond.push(`COALESCE(l.adl_result,'SUCCESS') = 'SUCCESS'`);
    else if (f.result === 'FAILURE')
      cond.push(`l.adl_result IN ('FAILURE','DENIED')`);
    if (f.ip?.trim())
      add('l.adl_ip LIKE ?', `${f.ip.trim().replace(/[%_\\]/g, '\\$&')}%`);
    if (f.q?.trim())
      add('(l.adl_actor_name ILIKE ? OR u.usr_name ILIKE ?)', like(f.q));
    if (f.target?.trim())
      add(
        '(l.adl_target_label ILIKE ? OR l.adl_entity_id ILIKE ?)',
        like(f.target),
      );
    if (f.targetType?.trim())
      add('l.adl_entity_type = ?', f.targetType.trim().slice(0, 50));
    if (f.targetId?.trim())
      add('l.adl_entity_id = ?', f.targetId.trim().slice(0, 64));
    return { sql: cond.join(' AND '), params };
  }

  private select(where: string) {
    return `SELECT l.adl_id::text id, l.created_at::text "createdAt", l.adl_actor_kind "actorKind",
                   l.adl_user_id::text "actorId", COALESCE(l.adl_actor_name, u.usr_name) "actorName",
                   COALESCE(l.adl_actor_role, u.usr_role) "actorRole", l.adl_action "action",
                   COALESCE(l.adl_menu, CASE WHEN l.adl_entity_type LIKE 'acm.aud%' THEN 'audit'
                     WHEN l.adl_entity_type LIKE 'acm.csl%' THEN 'csl'
                     WHEN l.adl_entity_type = 'SYS_GOOGLE_APP' THEN 'system' END) "menu",
                   l.adl_entity_type "targetType", l.adl_entity_id "targetId", l.adl_target_label "targetLabel",
                   l.adl_field_name "fields", COALESCE(l.adl_result, 'SUCCESS') "result", l.adl_http_method "method",
                   l.adl_http_path "path", l.adl_http_status "status", l.adl_ip "ip", l.adl_user_agent "userAgent",
                   l.adl_request_id "requestId", l.adl_reason "reason"
              FROM amb_acm_audit_log l
              LEFT JOIN amb_acm_user u ON u.usr_id = l.adl_user_id
             WHERE ${where}
             ORDER BY l.created_at DESC, l.adl_id DESC`;
  }

  async list(entId: string, f: ActivityLogFilter, page = 1) {
    const w = this.where(entId, f);
    const p = Math.max(1, Math.floor(page) || 1);
    const [rows, [{ total }]] = await Promise.all([
      this.ds.query<ActivityLogRow[]>(
        `${this.select(w.sql)} LIMIT ${ACTIVITY_PAGE_SIZE} OFFSET ${(p - 1) * ACTIVITY_PAGE_SIZE}`,
        w.params,
      ),
      this.ds.query<{ total: number }[]>(
        `SELECT count(*)::int total FROM amb_acm_audit_log l LEFT JOIN amb_acm_user u ON u.usr_id = l.adl_user_id WHERE ${w.sql}`,
        w.params,
      ),
    ]);
    return { rows, page: p, limit: ACTIVITY_PAGE_SIZE, total };
  }

  async exportRows(
    entId: string,
    f: ActivityLogFilter,
  ): Promise<ActivityLogRow[]> {
    const w = this.where(entId, f);
    return this.ds.query<ActivityLogRow[]>(
      `${this.select(w.sql)} LIMIT ${ACTIVITY_EXPORT_LIMIT}`,
      w.params,
    );
  }

  async summary(entId: string) {
    const [row] = await this.ds.query<
      { today: number; deletes: number; downloads: number; failures: number }[]
    >(
      `SELECT count(*)::int today,
              count(*) FILTER (WHERE adl_action='DELETE')::int deletes,
              count(*) FILTER (WHERE adl_action IN ('DOWNLOAD','EXPORT'))::int downloads,
              count(*) FILTER (WHERE adl_result IN ('FAILURE','DENIED'))::int failures
         FROM amb_acm_audit_log
        WHERE ent_id=$1
          AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')`,
      [entId],
    );
    return row;
  }

  async menus(entId: string): Promise<string[]> {
    const rows = await this.ds.query<{ menu: string }[]>(
      `SELECT DISTINCT adl_menu menu FROM amb_acm_audit_log
        WHERE ent_id=$1 AND adl_menu IS NOT NULL AND created_at >= now() - interval '366 days' ORDER BY 1`,
      [entId],
    );
    return rows.map((r) => r.menu);
  }
}
