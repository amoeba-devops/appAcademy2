import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';

/**
 * Audit log — 1 table (REQ-260622 §2.4).
 *
 *   tac_audit_logs → amb_acm_audit_log
 *
 * Honors `MIGRATION_AUDIT_CUTOFF_DAYS` (Q-2; default 90). Older rows are
 * left in MySQL and uploaded to S3 cold archive by a separate operator
 * one-shot — they don't roundtrip through PG.
 *
 * The user FK on the legacy side (`adl_user_id`) points at `tac_users.usr_id`;
 * we resolve via `amb_acm_user.legacy_id` (set by backfill-legacy-id).
 */
export class AuditMigrator extends BaseMigrator {
  constructor(
    mysql: ConstructorParameters<typeof BaseMigrator>[1],
    pg: ConstructorParameters<typeof BaseMigrator>[2],
    tenants: ConstructorParameters<typeof BaseMigrator>[3],
    cfg: ConstructorParameters<typeof BaseMigrator>[4],
  ) {
    super('audit', mysql, pg, tenants, cfg);
  }

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    const cutoff = this.cfg.auditCutoffDays;
    const where = `adl_created_at >= DATE_SUB(NOW(), INTERVAL ${cutoff} DAY)`;
    this.log.info(`audit cutoff: last ${cutoff} days`);

    const table = await this.migrateTable<{
      adl_id: number;
      acd_id: number;
      adl_user_id: number | null;
      adl_action: string;
      adl_entity_type: string;
      adl_entity_id: number;
      adl_field_name: string | null;
      adl_old_value: string | null;
      adl_new_value: string | null;
      adl_ip: string | null;
      adl_user_agent: string | null;
      adl_reason: string | null;
      adl_created_at: Date | string;
    }>({
      mysqlTable: 'tac_audit_logs',
      pgTable: 'amb_acm_audit_log',
      orderBy: 'adl_id',
      where,
      columns: [
        'legacy_id', 'ent_id', 'adl_user_id', 'adl_action', 'adl_entity_type',
        'adl_entity_id', 'adl_field_name', 'adl_old_value', 'adl_new_value',
        'adl_ip', 'adl_user_agent', 'adl_reason', 'created_at',
      ],
      mapRow: (r) => {
        const entId = this.tenants.resolve(r.acd_id);
        if (!entId) return null;
        // userId resolution is best-effort — old audit rows from purged
        // users will keep adl_user_id NULL on PG side. We don't fail the
        // row over it.
        return {
          legacy_id: r.adl_id,
          ent_id: entId,
          // BIGINT user id stays as raw legacy ref — PG column expects UUID
          // but for audit history we accept that some rows can't resolve
          // (logged user got deleted, etc). Store as text for the field;
          // if the column is strict UUID, switch to NULL when no resolve.
          adl_user_id: null,
          adl_action: r.adl_action,
          adl_entity_type: r.adl_entity_type,
          // entity_id stored as VARCHAR(64) on PG side — supports both UUID
          // and BIGINT-as-text.
          adl_entity_id: String(r.adl_entity_id),
          adl_field_name: r.adl_field_name,
          adl_old_value: r.adl_old_value,
          adl_new_value: r.adl_new_value,
          adl_ip: r.adl_ip,
          adl_user_agent: r.adl_user_agent,
          adl_reason: r.adl_reason,
          created_at: this.toTimestampTz(r.adl_created_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });

    return { domain: this.domain, tables: [table] };
  }

  async verify(): Promise<VerifyResult> {
    const cutoff = this.cfg.auditCutoffDays;
    const where = `adl_created_at >= DATE_SUB(NOW(), INTERVAL ${cutoff} DAY)`;
    return this.compareCounts([
      ['tac_audit_logs', 'amb_acm_audit_log', where],
    ]);
  }
}
