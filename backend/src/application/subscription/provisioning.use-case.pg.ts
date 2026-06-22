import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ACM_DS } from '../../modules/acm-common/datasource';

/**
 * PG-only refund-policy seed helper (REQ-260622 Phase 4 T4-02).
 *
 * Standalone helper for the legacy `provisioning.use-case.ts` `applySeedTemplate`
 * method — drops the MySQL-specific `INSERT IGNORE` syntax in favour of
 * PG `ON CONFLICT DO NOTHING`, and targets `amb_acm_pay_refund_policy*` instead
 * of `tac_pay_refund_polic*`.
 *
 * The full provisioning use case still has other responsibilities (subscription
 * event ledger, tenant lifecycle hooks) handled by the surrounding service —
 * Phase 4 cutover swaps just this seed step. The function signature accepts an
 * `entId UUID` (vs the legacy `acdId BIGINT`); the controller resolves the
 * mapping from AMA tenant id → ACM `amb_acm_tenant.tnt_ent_id` upstream.
 *
 * @see docs/plan/PLN-260622-mysql-to-postgres-full-migration.md Phase 4 T4-02
 */

const DEFAULT_TIERS: Array<{
  order: number;
  min: number;
  max: number;
  rate: number;
  note: string;
}> = [
  { order: 1, min: 0.0,    max: 0.0001, rate: 1.0,    note: '수강 개시 전 — 전액 환불' },
  { order: 2, min: 0.0001, max: 0.3333, rate: 0.6667, note: '1/3 경과 전 — 2/3 환불' },
  { order: 3, min: 0.3334, max: 0.5000, rate: 0.5,    note: '1/2 경과 전 — 1/2 환불' },
  { order: 4, min: 0.5001, max: 1.0000, rate: 0.0,    note: '1/2 경과 후 — 환불 불가' },
];

export class ProvisioningPgSeed {
  constructor(
    @InjectDataSource(ACM_DS)
    private readonly ds: DataSource,
  ) {}

  /**
   * Seed the default 학원법 §18 refund policy + 4 tiers. Idempotent —
   * re-running on a tenant that already has the v1 policy is a no-op.
   *
   * Usage:
   *   await this.ds.transaction(async (mgr) => {
   *     await provisioning.applySeedTemplate(mgr, entId);
   *   });
   */
  async applySeedTemplate(mgr: EntityManager, entId: string): Promise<void> {
    // 1) Insert policy v1 (idempotent on uq_acm_pay_refund_policy_ent_version).
    await mgr.query(
      `INSERT INTO amb_acm_pay_refund_policy
         (ent_id, prp_version, prp_basis, prp_label,
          prp_effective_from, prp_is_default_template)
       VALUES ($1, 1, 'SESSION', '학원법 §18 기본 환불정책 v1', CURRENT_DATE, TRUE)
       ON CONFLICT (ent_id, prp_version) DO NOTHING`,
      [entId],
    );

    // 2) Look up the policy id (could be either freshly-inserted or pre-existing).
    const rows: Array<{ prp_id: string }> = await mgr.query(
      `SELECT prp_id FROM amb_acm_pay_refund_policy
        WHERE ent_id = $1 AND prp_version = 1
        LIMIT 1`,
      [entId],
    );
    const prpId = rows[0]?.prp_id;
    if (prpId == null) return; // unexpected — log + bail

    // 3) Seed tiers (idempotent on uq_acm_pay_refund_policy_tier_order).
    for (const t of DEFAULT_TIERS) {
      await mgr.query(
        `INSERT INTO amb_acm_pay_refund_policy_tier
           (prp_id, prt_tier_order, prt_elapsed_ratio_min, prt_elapsed_ratio_max,
            prt_refund_rate, prt_note)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (prp_id, prt_tier_order) DO NOTHING`,
        [prpId, t.order, t.min, t.max, t.rate, t.note],
      );
    }
  }
}
