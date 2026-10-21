import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { currentRequestMeta } from '../../acm-common/http/request-meta';
import { currentSessionClient } from '../../acm-common/session/session-client';
import type {
  AccessActor,
  AccessEvent,
  AccessMethod,
  AccessReason,
  AccessResult,
} from './aud.types';

export interface AccessRecord {
  actor: AccessActor;
  event: AccessEvent;
  result: AccessResult;
  reason?: AccessReason | null;
  method?: AccessMethod | null;
  byUserId?: string | null;
}

/** REQ-261021B — append-only access log. Never throws: a logging failure must not block login. */
@Injectable()
export class AccessLogService {
  private readonly logger = new Logger(AccessLogService.name);
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async record(r: AccessRecord): Promise<void> {
    const meta = currentRequestMeta();
    try {
      await this.ds.query(
        `INSERT INTO amb_acm_aud_access_log
           (ent_id, aal_actor_kind, aal_actor_id, aal_actor_name, aal_actor_role, aal_login_id,
            aal_event, aal_result, aal_reason, aal_method, aal_ip, aal_client, aal_user_agent, aal_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          r.actor.entId,
          r.actor.kind,
          r.actor.id ?? null,
          r.actor.name?.slice(0, 100) ?? null,
          r.actor.role ?? null,
          r.actor.loginId?.slice(0, 200) ?? null,
          r.event,
          r.result,
          r.reason ?? null,
          r.method ?? null,
          meta.ip || null,
          currentSessionClient(),
          meta.userAgent || null,
          r.byUserId ?? null,
        ],
      );
    } catch (e) {
      this.logger.warn(
        `access log write failed event=${r.event}: ${(e as Error).message}`,
      );
    }
  }
}
