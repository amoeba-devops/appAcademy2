import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';
import { IdMap } from '../lib/id-map';

/**
 * Payment domain — 6 tables (REQ-260622 §2.1).
 *
 * Order matters (FK dependency):
 *   1. refund_policy        — only depends on tenant
 *   2. refund_policy_tier   — FK to refund_policy (legacy_id resolve)
 *   3. order                — FK to refund_policy + enrollment (see gap note)
 *   4. ledger               — FK to order + refund_policy_tier
 *   5. receipt              — FK to order (BYTEA buyer_identifier preserved as Buffer)
 *   6. tax_invoice          — FK to order
 *
 * Enrollment FK gap: `amb_acm_csl_enrollment` doesn't yet have a
 * `legacy_id` column. Phase 3 prerequisite is a small ALTER TABLE on
 * the 14 dual-write tables OR an alternative matching scheme (e.g., a
 * pre-built CSV map). Until that's in place, orders whose enrollment
 * can't be resolved are skipped + counted under `pgSkipped`.
 */
export class PayMigrator extends BaseMigrator {
  // Per-run caches — instantiated lazily per method since some methods
  // don't need every map.
  private rfpMap?: IdMap;
  private prtMap?: IdMap;
  private orderMap?: IdMap;
  private enrollmentMap?: IdMap;

  private get refundPolicyMap(): IdMap {
    if (!this.rfpMap) {
      this.rfpMap = new IdMap(this.pg, 'amb_acm_pay_refund_policy', 'prp_id');
    }
    return this.rfpMap;
  }
  private get refundTierMap(): IdMap {
    if (!this.prtMap) {
      this.prtMap = new IdMap(this.pg, 'amb_acm_pay_refund_policy_tier', 'prt_id');
    }
    return this.prtMap;
  }
  private get payOrderMap(): IdMap {
    if (!this.orderMap) {
      this.orderMap = new IdMap(this.pg, 'amb_acm_pay_order', 'pod_id');
    }
    return this.orderMap;
  }
  private get acmEnrollmentMap(): IdMap {
    if (!this.enrollmentMap) {
      // REQ-260622 model decision X — pay.enrollment_id → amb_acm_cls_enrollment
      // (class enrollment), NOT csl_enrollment (consultation pipeline marker).
      this.enrollmentMap = new IdMap(this.pg, 'amb_acm_cls_enrollment', 'ce_id');
    }
    return this.enrollmentMap;
  }

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
  // 1) refund_policy — tenant-only FK
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
      rfp_created_at: Date | string;
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
          this.log.warn(`skip refund_policy ${r.rfp_id} — tenant not mapped`, { acd_id: r.acd_id });
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
  // 2) refund_policy_tier — FK via refund_policy.legacy_id (preBatch)
  // ----------------------------------------------------------------------
  private migrateRefundPolicyTiers(opts: MigrateOptions) {
    type Row = {
      rpt_id: number;
      rfp_id: number;
      rpt_tier_order: number;
      rpt_elapsed_ratio_min: string;
      rpt_elapsed_ratio_max: string;
      rpt_refund_rate: string;
      rpt_note: string | null;
    };
    return this.migrateTable<Row, Map<number, string>>({
      mysqlTable: 'tac_pay_refund_policy_tiers',
      pgTable: 'amb_acm_pay_refund_policy_tier',
      orderBy: 'rpt_id',
      columns: [
        'legacy_id', 'prp_id', 'prt_tier_order',
        'prt_elapsed_ratio_min', 'prt_elapsed_ratio_max', 'prt_refund_rate',
        'prt_note',
      ],
      preBatch: (batch) =>
        this.refundPolicyMap.resolveMany(batch.map((r) => r.rfp_id)),
      mapRow: (r, rfpMap) => {
        const prp_id = rfpMap.get(Number(r.rfp_id));
        if (!prp_id) {
          this.log.warn(`skip refund_policy_tier ${r.rpt_id} — parent policy not in PG`, {
            rfp_id: r.rfp_id,
          });
          return null;
        }
        return {
          legacy_id: r.rpt_id,
          prp_id,
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
  // 3) order — FK to refund_policy (resolvable) + enrollment (gap)
  // ----------------------------------------------------------------------
  private migrateOrders(opts: MigrateOptions) {
    type Row = {
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
      pod_expires_at: Date | string | null;
      pod_approved_at: Date | string | null;
      pod_canceled_at: Date | string | null;
      pod_created_at: Date | string;
      pod_updated_at: Date | string;
    };
    return this.migrateTable<Row, {
      rfp: Map<number, string>;
      enr: Map<number, string>;
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
      preBatch: async (batch) => {
        const rfp = await this.refundPolicyMap.resolveMany(batch.map((r) => r.rfp_id));
        const enr = await this.acmEnrollmentMap.resolveMany(batch.map((r) => r.enr_id));
        return { rfp, enr };
      },
      mapRow: (r, ctx) => {
        const entId = this.tenants.resolve(r.acd_id);
        const prp_id = ctx.rfp.get(Number(r.rfp_id));
        const enrollment_id = ctx.enr.get(Number(r.enr_id));
        if (!entId || !prp_id || !enrollment_id) {
          this.log.warn(`skip pay_order ${r.pod_id}`, {
            tenantOk: !!entId, refundPolicyOk: !!prp_id, enrollmentOk: !!enrollment_id,
            acd_id: r.acd_id, rfp_id: r.rfp_id, enr_id: r.enr_id,
          });
          return null;
        }
        return {
          legacy_id: r.pod_id,
          ent_id: entId,
          enrollment_id,
          pod_order_no: r.pod_order_no,
          pod_idempotency_key: r.pod_idempotency_key,
          pod_amount: r.pod_amount,
          pod_currency: r.pod_currency,
          pod_method: r.pod_method,
          pod_pg_provider: r.pod_pg_provider,
          pod_pg_order_id: r.pod_pg_order_id,
          pod_pg_payment_key: r.pod_pg_payment_key,
          pod_status: r.pod_status,
          prp_id,
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
  // 4) ledger — FK to order + refund_policy_tier (nullable)
  // ----------------------------------------------------------------------
  private migrateLedger(opts: MigrateOptions) {
    type Row = {
      ldg_id: number;
      pod_id: number;
      ldg_entry_type: string;
      ldg_amount: string;
      ldg_balance_after: string;
      rpt_id: number | null;
      ldg_elapsed_ratio_at_refund: string | null;
      ldg_memo: string | null;
      ldg_recorded_by: number | null;
      ldg_recorded_at: Date | string;
    };
    return this.migrateTable<Row, {
      order: Map<number, string>;
      tier: Map<number, string>;
    }>({
      mysqlTable: 'tac_pay_ledger',
      pgTable: 'amb_acm_pay_ledger',
      orderBy: 'ldg_id',
      columns: [
        'legacy_id', 'pod_id', 'ldg_entry_type', 'ldg_amount',
        'ldg_balance_after', 'prt_id', 'ldg_elapsed_ratio_at_refund',
        'ldg_memo', 'ldg_recorded_at',
      ],
      preBatch: async (batch) => {
        const order = await this.payOrderMap.resolveMany(batch.map((r) => r.pod_id));
        // tier is nullable — skip rows with null rpt_id
        const tierIds = batch
          .map((r) => r.rpt_id)
          .filter((v): v is number => v != null);
        const tier = await this.refundTierMap.resolveMany(tierIds);
        return { order, tier };
      },
      mapRow: (r, ctx) => {
        const pod_id = ctx.order.get(Number(r.pod_id));
        if (!pod_id) {
          this.log.warn(`skip ledger ${r.ldg_id} — order not in PG`, { pod_id: r.pod_id });
          return null;
        }
        const prt_id = r.rpt_id != null ? ctx.tier.get(Number(r.rpt_id)) ?? null : null;
        return {
          legacy_id: r.ldg_id,
          pod_id,
          ldg_entry_type: r.ldg_entry_type,
          ldg_amount: r.ldg_amount,
          ldg_balance_after: r.ldg_balance_after,
          prt_id,
          ldg_elapsed_ratio_at_refund: r.ldg_elapsed_ratio_at_refund,
          ldg_memo: r.ldg_memo,
          ldg_recorded_at: this.toTimestampTz(r.ldg_recorded_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  // ----------------------------------------------------------------------
  // 5) receipt — BYTEA buyer_identifier preserved as Buffer (no re-enc)
  // ----------------------------------------------------------------------
  private migrateReceipts(opts: MigrateOptions) {
    type Row = {
      rct_id: number;
      pod_id: number;
      rct_receipt_type: string;
      rct_issued_at: Date | string;
      rct_pdf_url: string | null;
      rct_cash_receipt_no: string | null;
      rct_buyer_identifier: Buffer | null;
      rct_canceled_at: Date | string | null;
    };
    return this.migrateTable<Row, Map<number, string>>({
      mysqlTable: 'tac_pay_receipts',
      pgTable: 'amb_acm_pay_receipt',
      orderBy: 'rct_id',
      columns: [
        'legacy_id', 'pod_id', 'rct_receipt_type', 'rct_issued_at',
        'rct_pdf_url', 'rct_cash_receipt_no', 'rct_buyer_identifier',
        'rct_canceled_at',
      ],
      preBatch: (batch) =>
        this.payOrderMap.resolveMany(batch.map((r) => r.pod_id)),
      mapRow: (r, orderMap) => {
        const pod_id = orderMap.get(Number(r.pod_id));
        if (!pod_id) {
          this.log.warn(`skip receipt ${r.rct_id} — order not in PG`, { pod_id: r.pod_id });
          return null;
        }
        return {
          legacy_id: r.rct_id,
          pod_id,
          rct_receipt_type: r.rct_receipt_type,
          rct_issued_at: this.toTimestampTz(r.rct_issued_at),
          rct_pdf_url: r.rct_pdf_url,
          rct_cash_receipt_no: r.rct_cash_receipt_no,
          // VARBINARY(128) → BYTEA. mysql2 returns Buffer; pg accepts Buffer
          // directly. AES-GCM ciphertext bytes preserved 1:1 — NO re-encrypt
          // (REQ-260622 NFR-MYSQL-OUT-5).
          rct_buyer_identifier: r.rct_buyer_identifier,
          rct_canceled_at: this.toTimestampTz(r.rct_canceled_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  // ----------------------------------------------------------------------
  // 6) tax_invoice — FK to order
  // ----------------------------------------------------------------------
  private migrateTaxInvoices(opts: MigrateOptions) {
    type Row = {
      txi_id: number;
      pod_id: number;
      acd_id: number;
      txi_invoice_no: string;
      txi_nts_issue_no: string | null;
      txi_supplier_biz_no: string;
      txi_buyer_biz_no: string | null;
      txi_buyer_type: string;
      txi_supply_amount: string;
      txi_tax_amount: string;
      txi_total_amount: string;
      txi_issue_date: string;
      txi_status: string;
      txi_nts_submitted_at: Date | string | null;
      txi_nts_approved_at: Date | string | null;
      txi_nts_error_code: string | null;
      txi_nts_error_message: string | null;
      txi_xml_payload_url: string | null;
      txi_pdf_url: string | null;
      txi_created_at: Date | string;
      txi_updated_at: Date | string;
    };
    return this.migrateTable<Row, Map<number, string>>({
      mysqlTable: 'tac_pay_tax_invoices',
      pgTable: 'amb_acm_pay_tax_invoice',
      orderBy: 'txi_id',
      columns: [
        'legacy_id', 'pod_id', 'ent_id', 'txi_invoice_no', 'txi_nts_issue_no',
        'txi_supplier_biz_no', 'txi_buyer_biz_no', 'txi_buyer_type',
        'txi_supply_amount', 'txi_tax_amount', 'txi_total_amount',
        'txi_issue_date', 'txi_status',
        'txi_nts_submitted_at', 'txi_nts_approved_at',
        'txi_nts_error_code', 'txi_nts_error_message',
        'txi_xml_payload_url', 'txi_pdf_url',
        'created_at', 'updated_at',
      ],
      preBatch: (batch) =>
        this.payOrderMap.resolveMany(batch.map((r) => r.pod_id)),
      mapRow: (r, orderMap) => {
        const pod_id = orderMap.get(Number(r.pod_id));
        const entId = this.tenants.resolve(r.acd_id);
        if (!pod_id || !entId) {
          this.log.warn(`skip tax_invoice ${r.txi_id}`, {
            orderOk: !!pod_id, tenantOk: !!entId,
            pod_id: r.pod_id, acd_id: r.acd_id,
          });
          return null;
        }
        return {
          legacy_id: r.txi_id,
          pod_id,
          ent_id: entId,
          txi_invoice_no: r.txi_invoice_no,
          txi_nts_issue_no: r.txi_nts_issue_no,
          txi_supplier_biz_no: r.txi_supplier_biz_no,
          txi_buyer_biz_no: r.txi_buyer_biz_no,
          txi_buyer_type: r.txi_buyer_type,
          txi_supply_amount: r.txi_supply_amount,
          txi_tax_amount: r.txi_tax_amount,
          txi_total_amount: r.txi_total_amount,
          txi_issue_date: r.txi_issue_date,
          txi_status: r.txi_status,
          txi_nts_submitted_at: this.toTimestampTz(r.txi_nts_submitted_at),
          txi_nts_approved_at: this.toTimestampTz(r.txi_nts_approved_at),
          txi_nts_error_code: r.txi_nts_error_code,
          txi_nts_error_message: r.txi_nts_error_message,
          txi_xml_payload_url: r.txi_xml_payload_url,
          txi_pdf_url: r.txi_pdf_url,
          created_at: this.toTimestampTz(r.txi_created_at),
          updated_at: this.toTimestampTz(r.txi_updated_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }
}
