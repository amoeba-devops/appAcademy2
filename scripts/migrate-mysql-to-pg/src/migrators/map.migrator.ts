import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';
import { IdMap } from '../lib/id-map';

/**
 * MAP assessment — 8 tables (REQ-260622 §2.2).
 *
 * Order (FK):
 *   1. passage_asset       FK → passage (legacy_id resolved via backfill)
 *   2. item                FK → passage (optional), self FK on parent
 *   3. item_tag            FK → item (composite PK)
 *   4. test_set            tenant only
 *   5. test_set_item       FK → test_set + item
 *   6. assignment          FK → test_set; target = CLASS|STUDENT
 *   7. response            FK → assignment + student + item
 *                          UNIQUE (assignment, student, item) — idempotent
 *   8. score               FK → student + (nullable) assignment
 */
export class MapMigrator extends BaseMigrator {
  private passageMap?: IdMap;
  private itemMap?: IdMap;
  private testSetMap?: IdMap;
  private assignmentMap?: IdMap;
  private studentMap?: IdMap;
  private classMap?: IdMap;

  private get passage(): IdMap {
    if (!this.passageMap) this.passageMap = new IdMap(this.pg, 'amb_acm_map_passage', 'mpg_id');
    return this.passageMap;
  }
  private get item(): IdMap {
    if (!this.itemMap) this.itemMap = new IdMap(this.pg, 'amb_acm_map_item', 'mpi_id');
    return this.itemMap;
  }
  private get testSet(): IdMap {
    if (!this.testSetMap) this.testSetMap = new IdMap(this.pg, 'amb_acm_map_test_set', 'mts_id');
    return this.testSetMap;
  }
  private get assignment(): IdMap {
    if (!this.assignmentMap) this.assignmentMap = new IdMap(this.pg, 'amb_acm_map_assignment', 'mas_id');
    return this.assignmentMap;
  }
  private get student(): IdMap {
    if (!this.studentMap) this.studentMap = new IdMap(this.pg, 'amb_acm_std_student', 'std_id');
    return this.studentMap;
  }
  private get clsClass(): IdMap {
    if (!this.classMap) this.classMap = new IdMap(this.pg, 'amb_acm_cls_classes', 'cls_id');
    return this.classMap;
  }

  constructor(
    mysql: ConstructorParameters<typeof BaseMigrator>[1],
    pg: ConstructorParameters<typeof BaseMigrator>[2],
    tenants: ConstructorParameters<typeof BaseMigrator>[3],
    cfg: ConstructorParameters<typeof BaseMigrator>[4],
  ) {
    super('map', mysql, pg, tenants, cfg);
  }

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    const tables: MigrateResult['tables'] = [];
    tables.push(await this.migratePassageAssets(opts));
    tables.push(await this.migrateItems(opts));
    tables.push(await this.migrateItemTags(opts));
    tables.push(await this.migrateTestSets(opts));
    tables.push(await this.migrateTestSetItems(opts));
    tables.push(await this.migrateAssignments(opts));
    tables.push(await this.migrateResponses(opts));
    tables.push(await this.migrateScores(opts));
    return { domain: this.domain, tables };
  }

  async verify(): Promise<VerifyResult> {
    return this.compareCounts([
      ['tac_map_passage_assets', 'amb_acm_map_passage_asset'],
      ['tac_map_items',          'amb_acm_map_item'],
      ['tac_map_item_tags',      'amb_acm_map_item_tag'],
      ['tac_map_test_sets',      'amb_acm_map_test_set'],
      ['tac_map_test_set_items', 'amb_acm_map_test_set_item'],
      ['tac_map_assignments',    'amb_acm_map_assignment'],
      ['tac_map_responses',      'amb_acm_map_response'],
      ['tac_map_scores',         'amb_acm_map_score'],
    ]);
  }

  // ----------------------------------------------------------------------
  private migratePassageAssets(opts: MigrateOptions) {
    type Row = {
      pas_id: number;
      psg_id: number;
      pas_asset_url: string;
      pas_alt_text: string | null;
      pas_ordinal: number;
    };
    return this.migrateTable<Row, Map<number, string>>({
      mysqlTable: 'tac_map_passage_assets',
      pgTable: 'amb_acm_map_passage_asset',
      orderBy: 'pas_id',
      columns: ['legacy_id', 'mpg_id', 'mpa_asset_url', 'mpa_alt_text', 'mpa_ordinal'],
      preBatch: (batch) => this.passage.resolveMany(batch.map((r) => r.psg_id)),
      mapRow: (r, pmap) => {
        const mpg_id = pmap.get(Number(r.psg_id));
        if (!mpg_id) return null;
        return {
          legacy_id: r.pas_id,
          mpg_id,
          mpa_asset_url: r.pas_asset_url,
          mpa_alt_text: r.pas_alt_text,
          mpa_ordinal: r.pas_ordinal,
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  // ----------------------------------------------------------------------
  // Items have a self-FK (parent_itm_id). Two-pass approach:
  //   pass 1: insert all rows with parent_id NULL — captures legacy_id
  //   pass 2: post-migrator SQL UPDATEs parent_id via legacy_id JOIN
  // Pass 2 is documented but not executed by this migrator (operator runs).
  // ----------------------------------------------------------------------
  private migrateItems(opts: MigrateOptions) {
    type Row = {
      itm_id: number;
      acd_id: number | null;
      psg_id: number | null;
      itm_parent_itm_id: number | null;
      itm_domain: string;
      itm_grade_level: string;
      itm_difficulty: string;
      itm_item_type: string;
      itm_stem: string;
      itm_options: unknown;
      itm_answer_keys: unknown;
      itm_explanation: string | null;
      itm_points: number;
      itm_version: number;
      itm_status: string;
      itm_created_at: Date | string;
    };
    return this.migrateTable<Row, Map<number, string>>({
      mysqlTable: 'tac_map_items',
      pgTable: 'amb_acm_map_item',
      orderBy: 'itm_id',
      columns: [
        'legacy_id', 'ent_id', 'mpg_id', 'mpi_domain', 'mpi_grade_level',
        'mpi_difficulty', 'mpi_item_type', 'mpi_stem', 'mpi_options',
        'mpi_answer_keys', 'mpi_explanation', 'mpi_points', 'mpi_version',
        'mpi_status', 'created_at',
        // parent_mpi_id intentionally omitted — Phase 3 post-SQL fills it.
      ],
      preBatch: (batch) => this.passage.resolveMany(
        batch.map((r) => r.psg_id).filter((v): v is number => v != null),
      ),
      mapRow: (r, pmap) => {
        const entId = r.acd_id != null ? this.tenants.resolve(r.acd_id) : null;
        const mpg_id = r.psg_id != null ? pmap.get(Number(r.psg_id)) ?? null : null;
        return {
          legacy_id: r.itm_id,
          ent_id: entId,
          mpg_id,
          mpi_domain: r.itm_domain,
          mpi_grade_level: r.itm_grade_level,
          mpi_difficulty: r.itm_difficulty,
          mpi_item_type: r.itm_item_type,
          mpi_stem: r.itm_stem,
          mpi_options: r.itm_options,
          mpi_answer_keys: r.itm_answer_keys,
          mpi_explanation: r.itm_explanation,
          mpi_points: r.itm_points,
          mpi_version: r.itm_version,
          mpi_status: r.itm_status,
          created_at: this.toTimestampTz(r.itm_created_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
    // Post-migrator SQL (operator runs):
    //   UPDATE amb_acm_map_item child
    //      SET mpi_parent_mpi_id = parent.mpi_id
    //     FROM amb_acm_map_item parent, tac_map_items src
    //    WHERE child.legacy_id = src.itm_id
    //      AND src.itm_parent_itm_id = parent.legacy_id;
  }

  // ----------------------------------------------------------------------
  private migrateItemTags(opts: MigrateOptions) {
    type Row = { itm_id: number; itg_tag: string };
    return this.migrateTable<Row, Map<number, string>>({
      mysqlTable: 'tac_map_item_tags',
      pgTable: 'amb_acm_map_item_tag',
      orderBy: 'itm_id', // composite PK; itm_id is leading
      columns: ['mpi_id', 'mit_tag'],
      preBatch: (batch) => this.item.resolveMany(batch.map((r) => r.itm_id)),
      mapRow: (r, imap) => {
        const mpi_id = imap.get(Number(r.itm_id));
        if (!mpi_id) return null;
        return {
          mpi_id,
          mit_tag: r.itg_tag,
        };
      },
      // Composite PK — onConflict can't use legacy_id (none on this table).
      // Use the actual PK columns for idempotency. pg-client wraps in parens.
      onConflict: 'mpi_id, mit_tag',
      opts,
    });
  }

  // ----------------------------------------------------------------------
  private migrateTestSets(opts: MigrateOptions) {
    return this.migrateTable<{
      tst_id: number;
      acd_id: number;
      tst_name: string;
      tst_composition_mode: string;
      tst_filter_criteria: unknown;
      tst_total_points: number;
      tst_status: string;
      tst_created_at: Date | string;
    }>({
      mysqlTable: 'tac_map_test_sets',
      pgTable: 'amb_acm_map_test_set',
      orderBy: 'tst_id',
      columns: [
        'legacy_id', 'ent_id', 'mts_name', 'mts_composition_mode',
        'mts_filter_criteria', 'mts_total_points', 'mts_status', 'created_at',
      ],
      mapRow: (r) => {
        const entId = this.tenants.resolve(r.acd_id);
        if (!entId) return null;
        return {
          legacy_id: r.tst_id,
          ent_id: entId,
          mts_name: r.tst_name,
          mts_composition_mode: r.tst_composition_mode,
          mts_filter_criteria: r.tst_filter_criteria,
          mts_total_points: r.tst_total_points,
          mts_status: r.tst_status,
          created_at: this.toTimestampTz(r.tst_created_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  // ----------------------------------------------------------------------
  private migrateTestSetItems(opts: MigrateOptions) {
    type Row = {
      tsi_id: number;
      tst_id: number;
      itm_id: number;
      tsi_ordinal: number;
      tsi_item_version_snapshot: unknown;
    };
    return this.migrateTable<Row, { ts: Map<number, string>; it: Map<number, string> }>({
      mysqlTable: 'tac_map_test_set_items',
      pgTable: 'amb_acm_map_test_set_item',
      orderBy: 'tsi_id',
      columns: ['legacy_id', 'mts_id', 'mpi_id', 'mtsi_ordinal', 'mtsi_item_version_snapshot'],
      preBatch: async (batch) => {
        const ts = await this.testSet.resolveMany(batch.map((r) => r.tst_id));
        const it = await this.item.resolveMany(batch.map((r) => r.itm_id));
        return { ts, it };
      },
      mapRow: (r, ctx) => {
        const mts_id = ctx.ts.get(Number(r.tst_id));
        const mpi_id = ctx.it.get(Number(r.itm_id));
        if (!mts_id || !mpi_id) return null;
        return {
          legacy_id: r.tsi_id,
          mts_id,
          mpi_id,
          mtsi_ordinal: r.tsi_ordinal,
          mtsi_item_version_snapshot: r.tsi_item_version_snapshot,
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  // ----------------------------------------------------------------------
  private migrateAssignments(opts: MigrateOptions) {
    type Row = {
      asn_id: number;
      tst_id: number;
      asn_target_type: string;
      asn_target_id: number;
      asn_due_at: Date | string;
      asn_status: string;
      asn_created_at: Date | string;
    };
    return this.migrateTable<Row, {
      ts: Map<number, string>;
      tgtCls: Map<number, string>;
      tgtStd: Map<number, string>;
    }>({
      mysqlTable: 'tac_map_assignments',
      pgTable: 'amb_acm_map_assignment',
      orderBy: 'asn_id',
      columns: [
        'legacy_id', 'mts_id', 'mas_target_type', 'mas_target_id',
        'mas_due_at', 'mas_status', 'created_at',
      ],
      preBatch: async (batch) => {
        const ts = await this.testSet.resolveMany(batch.map((r) => r.tst_id));
        const clsIds = batch.filter((r) => r.asn_target_type === 'CLASS').map((r) => r.asn_target_id);
        const stdIds = batch.filter((r) => r.asn_target_type === 'STUDENT').map((r) => r.asn_target_id);
        const tgtCls = await this.clsClass.resolveMany(clsIds);
        const tgtStd = await this.student.resolveMany(stdIds);
        return { ts, tgtCls, tgtStd };
      },
      mapRow: (r, ctx) => {
        const mts_id = ctx.ts.get(Number(r.tst_id));
        const targetMap = r.asn_target_type === 'CLASS' ? ctx.tgtCls : ctx.tgtStd;
        const mas_target_id = targetMap.get(Number(r.asn_target_id));
        if (!mts_id || !mas_target_id) return null;
        return {
          legacy_id: r.asn_id,
          mts_id,
          mas_target_type: r.asn_target_type,
          mas_target_id,
          mas_due_at: this.toTimestampTz(r.asn_due_at),
          mas_status: r.asn_status,
          created_at: this.toTimestampTz(r.asn_created_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  // ----------------------------------------------------------------------
  private migrateResponses(opts: MigrateOptions) {
    type Row = {
      rsp_id: number;
      asn_id: number;
      std_id: number;
      itm_id: number;
      rsp_answer: unknown;
      rsp_is_correct: number;
      rsp_points_earned: number;
      rsp_submitted_at: Date | string;
    };
    return this.migrateTable<Row, {
      asn: Map<number, string>;
      std: Map<number, string>;
      it: Map<number, string>;
    }>({
      mysqlTable: 'tac_map_responses',
      pgTable: 'amb_acm_map_response',
      orderBy: 'rsp_id',
      columns: [
        'legacy_id', 'mas_id', 'std_id', 'mpi_id', 'mrs_answer',
        'mrs_is_correct', 'mrs_points_earned', 'mrs_submitted_at',
      ],
      preBatch: async (batch) => {
        const asn = await this.assignment.resolveMany(batch.map((r) => r.asn_id));
        const std = await this.student.resolveMany(batch.map((r) => r.std_id));
        const it = await this.item.resolveMany(batch.map((r) => r.itm_id));
        return { asn, std, it };
      },
      mapRow: (r, ctx) => {
        const mas_id = ctx.asn.get(Number(r.asn_id));
        const std_id = ctx.std.get(Number(r.std_id));
        const mpi_id = ctx.it.get(Number(r.itm_id));
        if (!mas_id || !std_id || !mpi_id) return null;
        return {
          legacy_id: r.rsp_id,
          mas_id,
          std_id,
          mpi_id,
          mrs_answer: r.rsp_answer,
          mrs_is_correct: this.toBoolean(r.rsp_is_correct),
          mrs_points_earned: r.rsp_points_earned,
          mrs_submitted_at: this.toTimestampTz(r.rsp_submitted_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  // ----------------------------------------------------------------------
  private migrateScores(opts: MigrateOptions) {
    type Row = {
      msc_id: number;
      std_id: number;
      msc_assessed_at: string;
      msc_reading_score: number | null;
      msc_math_score: number | null;
      msc_language_score: number | null;
      msc_source: string;
      asn_id: number | null;
      msc_note: string | null;
    };
    return this.migrateTable<Row, {
      std: Map<number, string>;
      asn: Map<number, string>;
    }>({
      mysqlTable: 'tac_map_scores',
      pgTable: 'amb_acm_map_score',
      orderBy: 'msc_id',
      columns: [
        'legacy_id', 'std_id', 'mms_assessed_at', 'mms_reading_score',
        'mms_math_score', 'mms_language_score', 'mms_source', 'mas_id',
        'mms_note',
      ],
      preBatch: async (batch) => {
        const std = await this.student.resolveMany(batch.map((r) => r.std_id));
        const asnIds = batch.map((r) => r.asn_id).filter((v): v is number => v != null);
        const asn = await this.assignment.resolveMany(asnIds);
        return { std, asn };
      },
      mapRow: (r, ctx) => {
        const std_id = ctx.std.get(Number(r.std_id));
        if (!std_id) return null;
        const mas_id = r.asn_id != null ? ctx.asn.get(Number(r.asn_id)) ?? null : null;
        return {
          legacy_id: r.msc_id,
          std_id,
          mms_assessed_at: r.msc_assessed_at,
          mms_reading_score: r.msc_reading_score,
          mms_math_score: r.msc_math_score,
          mms_language_score: r.msc_language_score,
          mms_source: r.msc_source,
          mas_id,
          mms_note: r.msc_note,
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }
}
