import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';
import { IdMap } from '../lib/id-map';

/**
 * CSL aux + student-aux — 3 tables (REQ-260622 §2.6).
 *
 *   tac_visit_records             → amb_acm_csl_visit_record   (FK → inquiry)
 *   tac_consultation_intake_form  → amb_acm_csl_intake_form    (orphan)
 *   tac_external_test_scores      → amb_acm_std_external_test_score
 *                                                              (FK → student)
 *
 * intake_form has no inbound FK to migrate (`cif_promoted_cst_id` is best-
 * effort — when the original consultation has been backfilled into
 * amb_acm_csl_inquiry via the Q-5 path, we link; otherwise NULL).
 */
export class CslAuxMigrator extends BaseMigrator {
  private inquiryMap?: IdMap;
  private studentMap?: IdMap;

  private get inquiry(): IdMap {
    if (!this.inquiryMap) this.inquiryMap = new IdMap(this.pg, 'amb_acm_csl_inquiry', 'inq_id');
    return this.inquiryMap;
  }
  private get student(): IdMap {
    if (!this.studentMap) this.studentMap = new IdMap(this.pg, 'amb_acm_std_student', 'std_id');
    return this.studentMap;
  }

  constructor(
    mysql: ConstructorParameters<typeof BaseMigrator>[1],
    pg: ConstructorParameters<typeof BaseMigrator>[2],
    tenants: ConstructorParameters<typeof BaseMigrator>[3],
    cfg: ConstructorParameters<typeof BaseMigrator>[4],
  ) {
    super('csl-aux', mysql, pg, tenants, cfg);
  }

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    const tables: MigrateResult['tables'] = [];
    tables.push(await this.migrateVisitRecords(opts));
    tables.push(await this.migrateIntakeForms(opts));
    tables.push(await this.migrateExternalTestScores(opts));
    return { domain: this.domain, tables };
  }

  async verify(): Promise<VerifyResult> {
    return this.compareCounts([
      ['tac_visit_records',             'amb_acm_csl_visit_record'],
      ['tac_consultation_intake_form',  'amb_acm_csl_intake_form'],
      ['tac_external_test_scores',      'amb_acm_std_external_test_score'],
    ]);
  }

  private migrateVisitRecords(opts: MigrateOptions) {
    type Row = {
      vsr_id: number;
      cst_id: number; // legacy consultation id — resolves via inquiry.legacy_id
      vsr_scheduled_at: Date | string | null;
      vsr_visited_at: Date | string | null;
      vsr_outcome: string | null;
      vsr_handler_user_id: number | null;
      vsr_memo: string | null;
      vsr_created_at: Date | string;
    };
    return this.migrateTable<Row, Map<number, string>>({
      mysqlTable: 'tac_visit_records',
      pgTable: 'amb_acm_csl_visit_record',
      orderBy: 'vsr_id',
      columns: [
        'legacy_id', 'ent_id', 'inq_id', 'vsr_scheduled_at', 'vsr_visited_at',
        'vsr_outcome', 'vsr_memo', 'created_at',
      ],
      preBatch: (batch) => this.inquiry.resolveMany(batch.map((r) => r.cst_id)),
      mapRow: (r, inqMap) => {
        const inq_id = inqMap.get(Number(r.cst_id));
        if (!inq_id) {
          this.log.warn(`skip visit_record ${r.vsr_id} — inquiry not in PG`, {
            cst_id: r.cst_id,
          });
          return null;
        }
        // ent_id is derivable from the PG inquiry — fetch via subquery in
        // a single-row INSERT trigger? We don't have that, so look it up
        // via a per-batch query would add complexity. Simpler: store NULL
        // and let a one-shot UPDATE backfill ent_id from inquiry. Or
        // refactor preBatch to also return ent_id. For now: SELECT inline.
        return {
          legacy_id: r.vsr_id,
          ent_id: '00000000-0000-0000-0000-000000000000', // placeholder; see note
          inq_id,
          vsr_scheduled_at: this.toTimestampTz(r.vsr_scheduled_at),
          vsr_visited_at: this.toTimestampTz(r.vsr_visited_at),
          vsr_outcome: r.vsr_outcome,
          vsr_memo: r.vsr_memo,
          created_at: this.toTimestampTz(r.vsr_created_at),
        };
        // NOTE: post-INSERT, run once:
        //   UPDATE amb_acm_csl_visit_record v
        //      SET ent_id = i.ent_id
        //     FROM amb_acm_csl_inquiry i
        //    WHERE v.inq_id = i.inq_id AND v.ent_id = '00000000-...';
        // This is captured as a Phase 3 post-migrator SQL.
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  private migrateIntakeForms(opts: MigrateOptions) {
    return this.migrateTable<{
      cif_id: number;
      acd_id: number;
      cif_parent_name: string;
      cif_phone: string;
      cif_email: string | null;
      cif_child_grade: string | null;
      cif_program_interest: string | null;
      cif_preferred_date: string | null;
      cif_message: string | null;
      cif_is_consent_pi: number;
      cif_captcha_score: string | null;
      cif_ip: string | null;
      cif_user_agent: string | null;
      cif_status: string;
      cif_promoted_cst_id: number | null;
      cif_created_at: Date | string;
    }>({
      mysqlTable: 'tac_consultation_intake_form',
      pgTable: 'amb_acm_csl_intake_form',
      orderBy: 'cif_id',
      columns: [
        'legacy_id', 'ent_id', 'cif_parent_name', 'cif_phone', 'cif_email',
        'cif_child_grade', 'cif_program_interest', 'cif_preferred_date',
        'cif_message', 'cif_is_consent_pi', 'cif_captcha_score',
        'cif_ip', 'cif_user_agent', 'cif_status', 'created_at',
      ],
      mapRow: (r) => {
        const entId = this.tenants.resolve(r.acd_id);
        if (!entId) return null;
        return {
          legacy_id: r.cif_id,
          ent_id: entId,
          cif_parent_name: r.cif_parent_name,
          cif_phone: r.cif_phone,
          cif_email: r.cif_email,
          cif_child_grade: r.cif_child_grade,
          cif_program_interest: r.cif_program_interest,
          cif_preferred_date: r.cif_preferred_date,
          cif_message: r.cif_message,
          cif_is_consent_pi: this.toBoolean(r.cif_is_consent_pi),
          cif_captcha_score: r.cif_captcha_score,
          cif_ip: r.cif_ip,
          cif_user_agent: r.cif_user_agent,
          cif_status: r.cif_status,
          // cif_promoted_inq_id resolution requires inquiry.legacy_id —
          // optional, populated by post-migrator SQL when inquiry backfill
          // ran successfully.
          created_at: this.toTimestampTz(r.cif_created_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  private migrateExternalTestScores(opts: MigrateOptions) {
    type Row = {
      ets_id: number;
      std_id: number;
      ets_test_type: string;
      ets_test_date: string;
      ets_score: string | null;
      ets_score_detail: unknown;
      ets_note: string | null;
    };
    return this.migrateTable<Row, Map<number, string>>({
      mysqlTable: 'tac_external_test_scores',
      pgTable: 'amb_acm_std_external_test_score',
      orderBy: 'ets_id',
      columns: [
        'legacy_id', 'std_id', 'ets_test_type', 'ets_test_date',
        'ets_score', 'ets_score_detail', 'ets_note',
      ],
      preBatch: (batch) => this.student.resolveMany(batch.map((r) => r.std_id)),
      mapRow: (r, stdMap) => {
        const std_id = stdMap.get(Number(r.std_id));
        if (!std_id) return null;
        return {
          legacy_id: r.ets_id,
          std_id,
          ets_test_type: r.ets_test_type,
          ets_test_date: r.ets_test_date,
          ets_score: r.ets_score,
          ets_score_detail: r.ets_score_detail,
          ets_note: r.ets_note,
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }
}
