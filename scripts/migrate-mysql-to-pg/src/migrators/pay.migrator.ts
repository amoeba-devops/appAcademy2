import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';

/**
 * Payment domain — 6 tables (REQ-260622 §2.1).
 *
 * Order matters (FK dependency):
 *   1. refund_policy        — no FK
 *   2. refund_policy_tier   — FK to refund_policy
 *   3. order                — FK to refund_policy + enrollment (already migrated)
 *   4. ledger               — FK to order + refund_policy_tier
 *   5. receipt              — FK to order (BYTEA buyer_identifier preserved as-is)
 *   6. tax_invoice          — FK to order
 *
 * All IDs are new UUIDs; `legacy_id BIGINT UNIQUE` preserves MySQL PKs
 * for FK resolution between tables in the same run.
 */
export class PayMigrator extends BaseMigrator {
  constructor(
    mysql: ConstructorParameters<typeof BaseMigrator>[1],
    pg: ConstructorParameters<typeof BaseMigrator>[2],
    tenants: ConstructorParameters<typeof BaseMigrator>[3],
    cfg: ConstructorParameters<typeof BaseMigrator>[4],
  ) {
    super('pay', mysql, pg, tenants, cfg);
  }

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    const tables: MigrateResult['tables'] = [];
    tables.push(await this.migrateRefundPolicies(opts));
    tables.push(await this.migrateRefundPolicyTiers(opts));
    tables.push(await this.migrateOrders(opts));
    tables.push(await this.migrateLedger(opts));
    tables.push(await this.migrateReceipts(opts));
    tables.push(await this.migrateTaxInvoices(opts));
    return { domain: this.domain, tables };
  }

  async verify(): Promise<VerifyResult> {
    return this.compareCounts([
      ['tac_pay_refund_policies',      'amb_acm_pay_refund_policy'],
      ['tac_pay_refund_policy_tiers',  'amb_acm_pay_refund_policy_tier'],
      ['tac_pay_orders',               'amb_acm_pay_order'],
      ['tac_pay_ledger',               'amb_acm_pay_ledger'],
      ['tac_pay_receipts',             'amb_acm_pay_receipt'],
      ['tac_pay_tax_invoices',         'amb_acm_pay_tax_invoice'],
    ]);
  }

  // ----------------------------------------------------------------------
  // 1) refund_policy
  // ----------------------------------------------------------------------
  private migrateRefundPolicies(opts: MigrateOptions) {
    return this.migrateTable<{
      rfp_id: number;
      acd_id: number;
      rfp_version: number;
      rfp_basis: string;
      rfp_label: string;
      rfp_effective_from: string;
      rfp_effective_to: string | null;
      rfp_is_default_template: number;
      rfp_created_by: number | null;
      rfp_created_at: string;
    }>({
      mysqlTable: 'tac_pay_refund_policies',
      pgTable: 'amb_acm_pay_refund_policy',
      orderBy: 'rfp_id',
      columns: [
        'legacy_id', 'ent_id', 'prp_version', 'prp_basis', 'prp_label',
        'prp_effective_from', 'prp_effective_to', 'prp_is_default_template',
        'created_at',
      ],
      mapRow: (r) => {
        const entId = this.tenants.resolve(r.acd_id);
        if (!entId) {
          this.log.warn(`skip refund_policy ${r.rfp_id} — tenant not mapped (acd_id=${r.acd_id})`);
          return null;
        }
        return {
          legacy_id: r.rfp_id,
          ent_id: entId,
          prp_version: r.rfp_version,
          prp_basis: r.rfp_basis,
          prp_label: r.rfp_label,
          prp_effective_from: r.rfp_effective_from,
          prp_effective_to: r.rfp_effective_to,
          prp_is_default_template: this.toBoolean(r.rfp_is_default_template),
          created_at: this.toTimestampTz(r.rfp_created_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  // ----------------------------------------------------------------------
  // 2) refund_policy_tier — FK resolves via PG SELECT on legacy_id
  // ----------------------------------------------------------------------
  private migrateRefundPolicyTiers(opts: MigrateOptions) {
    return this.migrateTable<{
      rpt_id: number;
      rfp_id: number;
      rpt_tier_order: number;
      rpt_elapsed_ratio_min: string;
      rpt_elapsed_ratio_max: string;
      rpt_refund_rate: string;
      rpt_note: string | null;
    }>({
      mysqlTable: 'tac_pay_refund_policy_tiers',
      pgTable: 'amb_acm_pay_refund_policy_tier',
      orderBy: 'rpt_id',
      columns: [
        'legacy_id', 'prp_id', 'prt_tier_order',
        'prt_elapsed_ratio_min', 'prt_elapsed_ratio_max', 'prt_refund_rate',
        'prt_note',
      ],
      mapRow: (r) => {
        // FK lookup — PG already has the parent row from step 1.
        // (synchronous resolution would be ideal, but we batch — see TODO below)
        return {
          legacy_id: r.rpt_id,
          // Placeholder — actual implementation needs an async pre-resolution
          // loop in this migrator. For Phase 3 implementation, see:
          // TODO: precompute prp_id by SELECTing legacy_id IN (...) before the
          // mapRow call; store in a Map, then mapRow just looks up.
          prp_id: null,
          prt_tier_order: r.rpt_tier_order,
          prt_elapsed_ratio_min: r.rpt_elapsed_ratio_min,
          prt_elapsed_ratio_max: r.rpt_elapsed_ratio_max,
          prt_refund_rate: r.rpt_refund_rate,
          prt_note: r.rpt_note,
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  // ----------------------------------------------------------------------
  // 3) order — FK to refund_policy + enrollment (already migrated by acm-csl)
  // ----------------------------------------------------------------------
  private async migrateOrders(opts: MigrateOptions) {
    // TODO Phase 3: build a per-batch FK pre-resolve map for both
    //   - prp_id (legacy_id → UUID)  via SELECT FROM amb_acm_pay_refund_policy
    //   - enrollment_id (legacy_id → UUID) via SELECT FROM amb_acm_csl_enrollment
    // For now, this is a stub demonstrating the structure.
    return this.migrateTable<{
      pod_id: number;
      acd_id: number;
      enr_id: number;
      pod_order_no: string;
      pod_idempotency_key: string;
      pod_amount: string;
      pod_currency: string;
      pod_method: string | null;
      pod_pg_provider: string;
      pod_pg_order_id: string | null;
      pod_pg_payment_key: string | null;
      pod_status: string;
      rfp_id: number;
      pod_expires_at: string | null;
      pod_approved_at: string | null;
      pod_canceled_at: string | null;
      pod_created_at: string;
      pod_updated_at: string;
    }>({
      mysqlTable: 'tac_pay_orders',
      pgTable: 'amb_acm_pay_order',
      orderBy: 'pod_id',
      columns: [
        'legacy_id', 'ent_id', 'enrollment_id', 'pod_order_no',
        'pod_idempotency_key', 'pod_amount', 'pod_currency', 'pod_method',
        'pod_pg_provider', 'pod_pg_order_id', 'pod_pg_payment_key', 'pod_status',
        'prp_id', 'pod_expires_at', 'pod_approved_at', 'pod_canceled_at',
        'created_at', 'updated_at',
      ],
      mapRow: (r) => {
        const entId = this.tenants.resolve(r.acd_id);
        if (!entId) return null;
        return {
          legacy_id: r.pod_id,
          ent_id: entId,
          enrollment_id: null, // TODO Phase 3 — pre-resolve via id-map
          pod_order_no: r.pod_order_no,
          pod_idempotency_key: r.pod_idempotency_key,
          pod_amount: r.pod_amount,
          pod_currency: r.pod_currency,
          pod_method: r.pod_method,
          pod_pg_provider: r.pod_pg_provider,
          pod_pg_order_id: r.pod_pg_order_id,
          pod_pg_payment_key: r.pod_pg_payment_key,
          pod_status: r.pod_status,
          prp_id: null, // TODO Phase 3 — pre-resolve
          pod_expires_at: this.toTimestampTz(r.pod_expires_at),
          pod_approved_at: this.toTimestampTz(r.pod_approved_at),
          pod_canceled_at: this.toTimestampTz(r.pod_canceled_at),
          created_at: this.toTimestampTz(r.pod_created_at),
          updated_at: this.toTimestampTz(r.pod_updated_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  // ----------------------------------------------------------------------
  // 4) ledger — TODO Phase 3 (similar pattern)
  // ----------------------------------------------------------------------
  private async migrateLedger(opts: MigrateOptions): Promise<MigrateResult['tables'][number]> {
    this.log.warn('migrateLedger not implemented yet — Phase 3 work');
    return {
      mysqlTable: 'tac_pay_ledger',
      pgTable: 'amb_acm_pay_ledger',
      mysqlCount: await this.mysql.count('tac_pay_ledger'),
      pgInserted: 0,
      pgSkipped: 0,
      durationMs: 0,
    };
  }

  // ----------------------------------------------------------------------
  // 5) receipt — BYTEA buyer_identifier preserved as Buffer (no re-encryption)
  // ----------------------------------------------------------------------
  private async migrateReceipts(opts: MigrateOptions): Promise<MigrateResult['tables'][number]> {
    this.log.warn('migrateReceipts not implemented yet — Phase 3 work');
    return {
      mysqlTable: 'tac_pay_receipts',
      pgTable: 'amb_acm_pay_receipt',
      mysqlCount: await this.mysql.count('tac_pay_receipts'),
      pgInserted: 0,
      pgSkipped: 0,
      durationMs: 0,
    };
  }

  // ----------------------------------------------------------------------
  // 6) tax_invoice
  // ----------------------------------------------------------------------
  private async migrateTaxInvoices(opts: MigrateOptions): Promise<MigrateResult['tables'][number]> {
    this.log.warn('migrateTaxInvoices not implemented yet — Phase 3 work');
    return {
      mysqlTable: 'tac_pay_tax_invoices',
      pgTable: 'amb_acm_pay_tax_invoice',
      mysqlCount: await this.mysql.count('tac_pay_tax_invoices'),
      pgInserted: 0,
      pgSkipped: 0,
      durationMs: 0,
    };
  }
}
