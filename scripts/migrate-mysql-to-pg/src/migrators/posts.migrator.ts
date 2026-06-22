import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';
import { IdMap } from '../lib/id-map';

/**
 * Posts / catalog — 4 tables (REQ-260622 §2.5).
 *
 *   tac_posts            → amb_acm_post
 *   tac_programs         → amb_acm_program
 *   tac_program_settings → amb_acm_program_setting   (FK → program)
 *   tac_classrooms       → amb_acm_classroom
 */
export class PostsMigrator extends BaseMigrator {
  private programMap?: IdMap;

  private get program(): IdMap {
    if (!this.programMap) {
      this.programMap = new IdMap(this.pg, 'amb_acm_program', 'prg_id');
    }
    return this.programMap;
  }

  constructor(
    mysql: ConstructorParameters<typeof BaseMigrator>[1],
    pg: ConstructorParameters<typeof BaseMigrator>[2],
    tenants: ConstructorParameters<typeof BaseMigrator>[3],
    cfg: ConstructorParameters<typeof BaseMigrator>[4],
  ) {
    super('posts', mysql, pg, tenants, cfg);
  }

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    const tables: MigrateResult['tables'] = [];
    tables.push(await this.migratePrograms(opts));
    tables.push(await this.migrateProgramSettings(opts));
    tables.push(await this.migrateClassrooms(opts));
    tables.push(await this.migratePosts(opts));
    return { domain: this.domain, tables };
  }

  async verify(): Promise<VerifyResult> {
    return this.compareCounts([
      ['tac_programs',          'amb_acm_program'],
      ['tac_program_settings',  'amb_acm_program_setting'],
      ['tac_classrooms',        'amb_acm_classroom'],
      ['tac_posts',             'amb_acm_post'],
    ]);
  }

  private migratePrograms(opts: MigrateOptions) {
    return this.migrateTable<{
      prg_id: number;
      acd_id: number;
      prg_name: string;
      prg_category: string;
      prg_description: string | null;
      prg_duration_weeks: number | null;
      prg_target_age_min: number | null;
      prg_target_age_max: number | null;
      prg_level: string | null;
      prg_status: string;
      prg_created_at: Date | string;
    }>({
      mysqlTable: 'tac_programs',
      pgTable: 'amb_acm_program',
      orderBy: 'prg_id',
      columns: [
        'legacy_id', 'ent_id', 'prg_name', 'prg_category', 'prg_description',
        'prg_duration_weeks', 'prg_target_age_min', 'prg_target_age_max',
        'prg_level', 'prg_status', 'created_at',
      ],
      mapRow: (r) => {
        const entId = this.tenants.resolve(r.acd_id);
        if (!entId) return null;
        return {
          legacy_id: r.prg_id,
          ent_id: entId,
          prg_name: r.prg_name,
          prg_category: r.prg_category,
          prg_description: r.prg_description,
          prg_duration_weeks: r.prg_duration_weeks,
          prg_target_age_min: r.prg_target_age_min,
          prg_target_age_max: r.prg_target_age_max,
          prg_level: r.prg_level,
          prg_status: r.prg_status,
          created_at: this.toTimestampTz(r.prg_created_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  private migrateProgramSettings(opts: MigrateOptions) {
    type Row = {
      pgs_id: number;
      prg_id: number;
      pgs_fee_amount: string | null;
      pgs_fee_currency: string;
      pgs_capacity_max: number | null;
      pgs_session_count: number | null;
      pgs_material_info: unknown;
      pgs_refund_policy: unknown;
    };
    return this.migrateTable<Row, Map<number, string>>({
      mysqlTable: 'tac_program_settings',
      pgTable: 'amb_acm_program_setting',
      orderBy: 'pgs_id',
      columns: [
        'legacy_id', 'prg_id', 'pgs_fee_amount', 'pgs_fee_currency',
        'pgs_capacity_max', 'pgs_session_count', 'pgs_material_info',
        'pgs_refund_policy',
      ],
      preBatch: (batch) => this.program.resolveMany(batch.map((r) => r.prg_id)),
      mapRow: (r, pmap) => {
        const prg_id = pmap.get(Number(r.prg_id));
        if (!prg_id) return null;
        return {
          legacy_id: r.pgs_id,
          prg_id,
          pgs_fee_amount: r.pgs_fee_amount,
          pgs_fee_currency: r.pgs_fee_currency,
          pgs_capacity_max: r.pgs_capacity_max,
          pgs_session_count: r.pgs_session_count,
          pgs_material_info: r.pgs_material_info,
          pgs_refund_policy: r.pgs_refund_policy,
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  private migrateClassrooms(opts: MigrateOptions) {
    return this.migrateTable<{
      clr_id: number;
      acd_id: number;
      clr_name: string;
      clr_capacity: number | null;
      clr_status: string;
    }>({
      mysqlTable: 'tac_classrooms',
      pgTable: 'amb_acm_classroom',
      orderBy: 'clr_id',
      columns: [
        'legacy_id', 'ent_id', 'clr_name', 'clr_capacity', 'clr_status',
      ],
      mapRow: (r) => {
        const entId = this.tenants.resolve(r.acd_id);
        if (!entId) return null;
        return {
          legacy_id: r.clr_id,
          ent_id: entId,
          clr_name: r.clr_name,
          clr_capacity: r.clr_capacity,
          clr_status: r.clr_status,
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  private migratePosts(opts: MigrateOptions) {
    return this.migrateTable<{
      pst_id: number;
      acd_id: number;
      pst_slug: string;
      pst_title: string;
      pst_body_md: string;
      pst_cover_image_url: string | null;
      pst_author_user_id: number | null;
      pst_published_at: Date | string | null;
      pst_status: string;
      pst_category: string;
      pst_created_at: Date | string;
      pst_updated_at: Date | string;
    }>({
      mysqlTable: 'tac_posts',
      pgTable: 'amb_acm_post',
      orderBy: 'pst_id',
      columns: [
        'legacy_id', 'ent_id', 'pst_slug', 'pst_title', 'pst_body_md',
        'pst_cover_image_url', 'pst_published_at', 'pst_status', 'pst_category',
        'created_at', 'updated_at',
      ],
      mapRow: (r) => {
        const entId = this.tenants.resolve(r.acd_id);
        if (!entId) return null;
        return {
          legacy_id: r.pst_id,
          ent_id: entId,
          pst_slug: r.pst_slug,
          pst_title: r.pst_title,
          pst_body_md: r.pst_body_md,
          pst_cover_image_url: r.pst_cover_image_url,
          // author_user_id needs user.legacy_id resolution — best-effort
          // skip for now (column is nullable). Phase 3 follow-up could add
          // the resolver if author attribution matters for the cutover.
          pst_published_at: this.toTimestampTz(r.pst_published_at),
          pst_status: r.pst_status,
          pst_category: r.pst_category,
          created_at: this.toTimestampTz(r.pst_created_at),
          updated_at: this.toTimestampTz(r.pst_updated_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }
}
