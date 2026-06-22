import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';

/**
 * AMA subscription webhook ledger — 1 table (REQ-260622 §2.7).
 *
 *   tac_subscription_events → amb_acm_subscription_event
 *
 * ent_id can be NULL for pre-provisioning events (the operator's tenant
 * row may not exist at the time the first SUBSCRIPTION_CREATED webhook
 * arrives). Preserve NULL when MySQL acd_id is NULL too.
 */
export class SubscriptionMigrator extends BaseMigrator {
  constructor(
    mysql: ConstructorParameters<typeof BaseMigrator>[1],
    pg: ConstructorParameters<typeof BaseMigrator>[2],
    tenants: ConstructorParameters<typeof BaseMigrator>[3],
    cfg: ConstructorParameters<typeof BaseMigrator>[4],
  ) {
    super('subscription', mysql, pg, tenants, cfg);
  }

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    const table = await this.migrateTable<{
      sub_id: number;
      acd_id: number | null;
      sub_ama_tenant_id: string;
      sub_event_type: string;
      sub_plan: string | null;
      sub_nonce: string;
      sub_signature: string;
      sub_event_at: Date | string;
      sub_payload: unknown;
      sub_processed_at: Date | string | null;
      sub_processing_error: string | null;
      sub_created_at: Date | string;
    }>({
      mysqlTable: 'tac_subscription_events',
      pgTable: 'amb_acm_subscription_event',
      orderBy: 'sub_id',
      columns: [
        'legacy_id', 'ent_id', 'sub_ama_tenant_id', 'sub_event_type',
        'sub_plan', 'sub_nonce', 'sub_signature', 'sub_event_at',
        'sub_payload', 'sub_processed_at', 'sub_processing_error',
        'created_at',
      ],
      mapRow: (r) => {
        const entId = r.acd_id != null ? this.tenants.resolve(r.acd_id) : null;
        // Preserve null entId — pre-provisioning events legitimately have no tenant.
        return {
          legacy_id: r.sub_id,
          ent_id: entId,
          sub_ama_tenant_id: r.sub_ama_tenant_id,
          sub_event_type: r.sub_event_type,
          sub_plan: r.sub_plan,
          sub_nonce: r.sub_nonce,
          sub_signature: r.sub_signature,
          sub_event_at: this.toTimestampTz(r.sub_event_at),
          sub_payload: r.sub_payload,
          sub_processed_at: this.toTimestampTz(r.sub_processed_at),
          sub_processing_error: r.sub_processing_error,
          created_at: this.toTimestampTz(r.sub_created_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });

    return { domain: this.domain, tables: [table] };
  }

  async verify(): Promise<VerifyResult> {
    return this.compareCounts([
      ['tac_subscription_events', 'amb_acm_subscription_event'],
    ]);
  }
}
