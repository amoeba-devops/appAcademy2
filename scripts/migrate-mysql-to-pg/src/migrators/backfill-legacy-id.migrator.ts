import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';

/**
 * Backfill `legacy_id` BIGINT on the 11 dual-write tables (REQ-260622 T0-05).
 *
 * The new column was added by `sql/acm/951-acm-dual-write-legacy-id.sql`, but
 * existing PG rows have NULL. This migrator walks each MySQL row and finds
 * the matching PG row by natural key, then UPDATEs PG with the MySQL PK as
 * legacy_id. After this runs, Phase 3 FK pre-resolvers (IdMap.resolveMany)
 * work against `amb_acm_*` parents.
 *
 * Three tiers by match confidence:
 *
 *   T1  STRONG    — unique natural key, deterministic match
 *                   • user                  (email UNIQUE)
 *                   • tch_teacher           (email UNIQUE)
 *                   • cls_classes           (code UNIQUE per ent_id)
 *                   • map_passage           (title + grade + version + ent_id)
 *
 *   T2  CHAINED   — composite key depending on a T1 backfill
 *                   • cls_sessions          (cls.legacy_id + date + start_time)
 *
 *   T3  OUT-OF-BAND — model mismatch / PII decryption required.
 *                   Operator must run a manual SQL pass before Phase 3.
 *                   • std_student           (PII: name + birth_date + parent_phone)
 *                   • std_parent            (PII: phone — needs ACM_PII_KEY)
 *                   • std_student_parent    (depends on above)
 *                   • csl_inquiry           (Q-5 partial-equiv reconcile)
 *                   • csl_enrollment        (model shift — see note below)
 *
 * `csl_enrollment` note: the PG `amb_acm_csl_enrollment` is conceptually a
 * "consultation pipeline stage marker" (FK → inquiry), whereas the MySQL
 * `tac_enrollments` is a "student enrolled in class" record. There may not
 * be a 1:1 row mapping. Phase 3 / Phase 4 prep should review and decide:
 *   - mirror MySQL rows into a new PG table (e.g., amb_acm_cls_enrollment), or
 *   - keep legacy_id NULL on amb_acm_csl_enrollment and re-anchor
 *     amb_acm_pay_order.enrollment_id to a different PG entity.
 * Until then, this migrator only backfills enrollment rows that have a
 * deterministic match (extremely rare in practice) and skips the rest.
 */
export class BackfillLegacyIdMigrator extends BaseMigrator {
  constructor(
    mysql: ConstructorParameters<typeof BaseMigrator>[1],
    pg: ConstructorParameters<typeof BaseMigrator>[2],
    tenants: ConstructorParameters<typeof BaseMigrator>[3],
    cfg: ConstructorParameters<typeof BaseMigrator>[4],
  ) {
    super('backfill-legacy-id', mysql, pg, tenants, cfg);
  }

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    const tables: MigrateResult['tables'] = [];
    // T1 — strong matches
    tables.push(await this.backfillUserByEmail(opts));
    tables.push(await this.backfillTeacherByEmail(opts));
    tables.push(await this.backfillClassesByCode(opts));
    tables.push(await this.backfillMapPassageByTitleGrade(opts));
    // T2 — chained on classes
    tables.push(await this.backfillSessionsByClassAndTime(opts));
    return { domain: this.domain, tables };
  }

  async verify(): Promise<VerifyResult> {
    // For backfill, "verify" = how many PG rows still have NULL legacy_id
    // per table. operator decides per-tenant whether the residual NULL set
    // is acceptable (orphan rows that pre-date MySQL data).
    const rows: VerifyResult['rows'] = [];
    for (const tbl of [
      'amb_acm_user',
      'amb_acm_tch_teacher',
      'amb_acm_cls_classes',
      'amb_acm_cls_sessions',
      'amb_acm_map_passage',
    ]) {
      const filled = await this.pg.count(tbl, 'legacy_id IS NOT NULL');
      const total = await this.pg.count(tbl);
      rows.push({
        mysqlTable: '(backfill)',
        pgTable: `${tbl} (filled / total)`,
        mysqlCount: filled,
        pgCount: total,
        diff: total - filled,
        ok: true, // informational — there's no "diff=0" criterion for backfill
      });
    }
    return { domain: this.domain, rows };
  }

  // --------------------------------------------------------------------
  // T1 — user (email UNIQUE)
  // --------------------------------------------------------------------
  private async backfillUserByEmail(
    opts: MigrateOptions,
  ): Promise<MigrateResult['tables'][number]> {
    return this.runMatch({
      mysqlTable: 'tac_users',
      pgTable: 'amb_acm_user',
      orderBy: 'usr_id',
      mysqlColumns: ['usr_id', 'usr_email'],
      // PG user PK column is `usr_id` (`amb_acm_user` uses prefix `usr_`).
      mapRowToWhere: (r) => ({
        sql: 'lower(usr_email) = lower($1) AND legacy_id IS NULL',
        params: [(r['usr_email'] as string | null)?.trim() ?? ''],
        skipReason: !((r['usr_email'] as string | null)?.trim()) ? 'no_email' : null,
      }),
      legacyIdOf: (r) => Number(r['usr_id']),
      opts,
    });
  }

  // --------------------------------------------------------------------
  // T1 — tch_teacher (email UNIQUE)
  // --------------------------------------------------------------------
  private async backfillTeacherByEmail(
    opts: MigrateOptions,
  ): Promise<MigrateResult['tables'][number]> {
    return this.runMatch({
      mysqlTable: 'tac_teachers',
      pgTable: 'amb_acm_tch_teacher',
      orderBy: 'tch_id',
      mysqlColumns: ['tch_id', 'tch_email'],
      mapRowToWhere: (r) => ({
        sql: 'lower(tch_email) = lower($1) AND legacy_id IS NULL',
        params: [(r['tch_email'] as string | null)?.trim() ?? ''],
        skipReason: !((r['tch_email'] as string | null)?.trim()) ? 'no_email' : null,
      }),
      legacyIdOf: (r) => Number(r['tch_id']),
      opts,
    });
  }

  // --------------------------------------------------------------------
  // T1 — cls_classes (code UNIQUE per ent_id)
  // --------------------------------------------------------------------
  private async backfillClassesByCode(
    opts: MigrateOptions,
  ): Promise<MigrateResult['tables'][number]> {
    return this.runMatch({
      mysqlTable: 'tac_classes',
      pgTable: 'amb_acm_cls_classes',
      orderBy: 'cls_id',
      mysqlColumns: ['cls_id', 'acd_id', 'cls_code'],
      mapRowToWhere: (r) => {
        const entId = this.tenants.resolve(Number(r['acd_id']));
        const code = (r['cls_code'] as string | null)?.trim();
        if (!entId) return { sql: '', params: [], skipReason: 'tenant_not_mapped' };
        if (!code) return { sql: '', params: [], skipReason: 'no_code' };
        return {
          sql: 'cls_code = $1 AND ent_id = $2 AND legacy_id IS NULL',
          params: [code, entId],
          skipReason: null,
        };
      },
      legacyIdOf: (r) => Number(r['cls_id']),
      opts,
    });
  }

  // --------------------------------------------------------------------
  // T1 — map_passage (title + grade + version + ent_id)
  // --------------------------------------------------------------------
  private async backfillMapPassageByTitleGrade(
    opts: MigrateOptions,
  ): Promise<MigrateResult['tables'][number]> {
    return this.runMatch({
      mysqlTable: 'tac_map_passages',
      pgTable: 'amb_acm_map_passage',
      orderBy: 'psg_id',
      mysqlColumns: ['psg_id', 'acd_id', 'psg_title', 'psg_grade_level', 'psg_version'],
      mapRowToWhere: (r) => {
        // acd_id may be NULL (shared pool — REQ MAP §Q-006). In that case
        // PG row's ent_id is also NULL (or sentinel). Match by title+grade
        // only; accept that mismatches go to operator review.
        const title = (r['psg_title'] as string | null)?.trim();
        const grade = r['psg_grade_level'] as string | null;
        const ver = r['psg_version'];
        if (!title || !grade) return { sql: '', params: [], skipReason: 'no_natural_key' };
        const acdRaw = r['acd_id'];
        if (acdRaw == null) {
          return {
            sql: 'mpg_title = $1 AND mpg_grade = $2 AND mpg_version = $3 AND ent_id IS NULL AND legacy_id IS NULL',
            params: [title, grade, ver],
            skipReason: null,
          };
        }
        const entId = this.tenants.resolve(Number(acdRaw));
        if (!entId) return { sql: '', params: [], skipReason: 'tenant_not_mapped' };
        return {
          sql: 'mpg_title = $1 AND mpg_grade = $2 AND mpg_version = $3 AND ent_id = $4 AND legacy_id IS NULL',
          params: [title, grade, ver, entId],
          skipReason: null,
        };
      },
      legacyIdOf: (r) => Number(r['psg_id']),
      opts,
    });
  }

  // --------------------------------------------------------------------
  // T2 — cls_sessions  (cls_id-via-legacy + date + start_time)
  //
  // Depends on T1 backfillClassesByCode having run first so amb_acm_cls_classes
  // rows have legacy_id populated.
  // --------------------------------------------------------------------
  private async backfillSessionsByClassAndTime(
    opts: MigrateOptions,
  ): Promise<MigrateResult['tables'][number]> {
    return this.runMatch({
      mysqlTable: 'tac_class_sessions',
      pgTable: 'amb_acm_cls_sessions',
      orderBy: 'css_id',
      mysqlColumns: ['css_id', 'cls_id', 'css_date', 'css_start_time'],
      mapRowToWhere: (r) => {
        const clsLegacy = Number(r['cls_id']);
        const date = r['css_date'];
        const startTime = r['css_start_time'];
        if (!clsLegacy || !date || !startTime) {
          return { sql: '', params: [], skipReason: 'incomplete_key' };
        }
        return {
          // The PG cls_id column on sessions is `cls_id UUID`, joined to
          // amb_acm_cls_classes.cls_id via the just-backfilled legacy_id.
          sql: `
            cls_id = (SELECT cls_id FROM amb_acm_cls_classes WHERE legacy_id = $1)
            AND ses_date = $2
            AND ses_start_time = $3
            AND legacy_id IS NULL
          `,
          params: [clsLegacy, date, startTime],
          skipReason: null,
        };
      },
      legacyIdOf: (r) => Number(r['css_id']),
      opts,
    });
  }

  // --------------------------------------------------------------------
  // Shared runner — iterate MySQL, run UPDATE per row when match unique.
  //
  // Why per-row instead of bulk: SQL update needs uniqueness per match
  // — if WHERE clause matches 2 rows, we must skip + log (don't mass-tag
  // wrong rows). Per-row UPDATE with `RETURNING 1` lets us count matches.
  // --------------------------------------------------------------------
  private async runMatch(input: {
    mysqlTable: string;
    pgTable: string;
    orderBy: string;
    mysqlColumns: string[];
    mapRowToWhere: (row: Record<string, unknown>) => {
      sql: string;
      params: unknown[];
      skipReason: string | null;
    };
    legacyIdOf: (row: Record<string, unknown>) => number;
    opts: MigrateOptions;
  }): Promise<MigrateResult['tables'][number]> {
    const start = Date.now();
    const totalMysql = await this.mysql.count(input.mysqlTable);
    const dryRun = input.opts.dryRun ?? this.cfg.dryRun;
    let matched = 0;
    let skippedNoKey = 0;
    let skippedNoMatch = 0;
    let skippedAmbiguous = 0;
    const skipReasons: Record<string, number> = {};

    this.log.info(`begin backfill ${input.mysqlTable} → ${input.pgTable}`, {
      total: totalMysql,
      dryRun,
    });

    for await (const batch of this.mysql.iterate<Record<string, unknown>>(
      input.mysqlTable,
      {
        orderBy: input.orderBy,
        batchSize: this.cfg.batchSize,
        columns: input.mysqlColumns,
        limit: input.opts.limit,
      },
    )) {
      for (const row of batch) {
        const { sql, params, skipReason } = input.mapRowToWhere(row);
        if (skipReason) {
          skippedNoKey++;
          skipReasons[skipReason] = (skipReasons[skipReason] ?? 0) + 1;
          continue;
        }

        // Find candidate rows first to detect ambiguity.
        const found = await this.pg.query<{ cnt: string }>(
          `SELECT COUNT(*)::bigint AS cnt FROM ${input.pgTable} WHERE ${sql}`,
          params,
        );
        const cnt = Number(found[0]?.cnt ?? 0);
        if (cnt === 0) {
          skippedNoMatch++;
          continue;
        }
        if (cnt > 1) {
          skippedAmbiguous++;
          this.log.warn(`ambiguous match (${cnt} rows) — skipping`, {
            mysqlTable: input.mysqlTable,
            legacy_id: input.legacyIdOf(row),
            sql,
          });
          continue;
        }

        if (dryRun) {
          matched++;
          continue;
        }
        const updateRes = await this.pg.query<{ updated: number }>(
          `UPDATE ${input.pgTable} SET legacy_id = $${params.length + 1} WHERE ${sql} RETURNING 1 AS updated`,
          [...params, input.legacyIdOf(row)],
        );
        if (updateRes.length === 1) matched++;
      }
    }

    const durationMs = Date.now() - start;
    this.log.info(`done backfill ${input.pgTable}`, {
      matched,
      skippedNoKey,
      skippedNoMatch,
      skippedAmbiguous,
      reasons: skipReasons,
      durationMs,
    });

    return {
      mysqlTable: input.mysqlTable,
      pgTable: input.pgTable,
      mysqlCount: totalMysql,
      pgInserted: matched,
      pgSkipped: skippedNoKey + skippedNoMatch + skippedAmbiguous,
      durationMs,
    };
  }
}
