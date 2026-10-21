import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import type { ActivityAction } from './activity-rules';

export interface ActivityRow {
  entId: string;
  userId: string | null;
  actorKind: 'CONSOLE' | 'PORTAL';
  actorName: string | null;
  actorRole: string | null;
  action: ActivityAction;
  menu: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  fields: string | null;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  method: string;
  path: string;
  status: number;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

/** PLN-261022 — append-only activity rows in amb_acm_audit_log. Never throws. */
@Injectable()
export class ActivityWriterService {
  private readonly logger = new Logger(ActivityWriterService.name);
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async write(r: ActivityRow): Promise<void> {
    try {
      await this.ds.query(
        `INSERT INTO amb_acm_audit_log
           (ent_id, adl_user_id, adl_action, adl_entity_type, adl_entity_id, adl_field_name, adl_ip, adl_user_agent,
            adl_actor_kind, adl_actor_name, adl_actor_role, adl_menu, adl_target_label, adl_result,
            adl_http_method, adl_http_path, adl_http_status, adl_request_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          r.entId,
          r.userId,
          r.action,
          (r.targetType ?? r.menu).slice(0, 50),
          (r.targetId ?? '-').slice(0, 64),
          r.fields,
          r.ip,
          r.userAgent,
          r.actorKind,
          r.actorName?.slice(0, 100) ?? null,
          r.actorRole?.slice(0, 20) ?? null,
          r.menu.slice(0, 30),
          r.targetLabel?.slice(0, 200) ?? null,
          r.result,
          r.method.slice(0, 10),
          r.path.slice(0, 300),
          r.status,
          r.requestId?.slice(0, 40) ?? null,
        ],
      );
    } catch (e) {
      this.logger.warn(
        `activity log write failed ${r.method} ${r.path}: ${(e as Error).message}`,
      );
    }
  }
}
