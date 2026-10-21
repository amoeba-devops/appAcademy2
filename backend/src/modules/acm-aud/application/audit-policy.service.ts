import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';

export interface AuditPolicy {
  failMax: number;
  /** 0 = lock until an administrator unlocks. */
  lockMinutes: number;
  ipFailMax: number;
  ipWindowMinutes: number;
  ipBlockMinutes: number;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
}

export const DEFAULT_AUDIT_POLICY: AuditPolicy = {
  failMax: 5,
  lockMinutes: 5,
  ipFailMax: 20,
  ipWindowMinutes: 10,
  ipBlockMinutes: 10,
  updatedAt: null,
  updatedBy: null,
  updatedByName: null,
};

/** REQ-261021B FR-C-3 — per-tenant access-control policy (defaults when no row). */
@Injectable()
export class AuditPolicyService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async get(entId: string): Promise<AuditPolicy> {
    const [row] = await this.ds.query<AuditPolicy[]>(
      `SELECT p.apl_fail_max "failMax", p.apl_lock_minutes "lockMinutes", p.apl_ip_fail_max "ipFailMax",
              p.apl_ip_window_minutes "ipWindowMinutes", p.apl_ip_block_minutes "ipBlockMinutes",
              p.updated_at::text "updatedAt", p.updated_by::text "updatedBy", u.usr_name "updatedByName"
         FROM amb_acm_aud_policy p
         LEFT JOIN amb_acm_user u ON u.usr_id = p.updated_by
        WHERE p.ent_id = $1`,
      [entId],
    );
    return row ?? { ...DEFAULT_AUDIT_POLICY };
  }

  async save(
    entId: string,
    v: Pick<
      AuditPolicy,
      | 'failMax'
      | 'lockMinutes'
      | 'ipFailMax'
      | 'ipWindowMinutes'
      | 'ipBlockMinutes'
    >,
    actorId: string,
  ): Promise<{ before: AuditPolicy; after: AuditPolicy }> {
    const before = await this.get(entId);
    await this.ds.query(
      `INSERT INTO amb_acm_aud_policy
         (ent_id, apl_fail_max, apl_lock_minutes, apl_ip_fail_max, apl_ip_window_minutes, apl_ip_block_minutes, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (ent_id) DO UPDATE SET
         apl_fail_max=EXCLUDED.apl_fail_max, apl_lock_minutes=EXCLUDED.apl_lock_minutes,
         apl_ip_fail_max=EXCLUDED.apl_ip_fail_max, apl_ip_window_minutes=EXCLUDED.apl_ip_window_minutes,
         apl_ip_block_minutes=EXCLUDED.apl_ip_block_minutes, updated_by=EXCLUDED.updated_by`,
      [
        entId,
        v.failMax,
        v.lockMinutes,
        v.ipFailMax,
        v.ipWindowMinutes,
        v.ipBlockMinutes,
        actorId,
      ],
    );
    return { before, after: await this.get(entId) };
  }
}
