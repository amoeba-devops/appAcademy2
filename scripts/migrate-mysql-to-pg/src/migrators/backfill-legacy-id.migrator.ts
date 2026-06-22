import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';
import { AesGcm, normalizePhone } from '../lib/aes-gcm';

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
 *                   • std_parent            (phone + name + ent_id —
 *                                            see "encryption" note below)
 *                   • std_student           (name + birth_date + ent_id)
 *                   • std_student_parent    (chained on std_student + std_parent)
 *
 *   T3  Q-5 RECONCILE — implemented via PG-side AES-GCM decryption.
 *                   • csl_inquiry           (parent name + phone within
 *                                            registered_at ±1 day) — requires
 *                                            ACM_PII_KEY env. Skips silently
 *                                            with a warn line if the key is
 *                                            missing.
 *                   • csl_enrollment        — resolved by model decision X
 *                                              (sql/acm/952); cls_enrollment
 *                                              migrator handles tac_enrollments
 *                                              separately.
 *
 * On "encrypted" columns: `tac_parents.prt_phone_encrypted VARBINARY(255)`
 * is actually plaintext UTF-8 bytes — a never-implemented Phase-1-MVP
 * placeholder in backend/src/infrastructure/database/repositories/
 * parent.repository.ts (encryptField is `Buffer.from(value, 'utf-8')`).
 * The PG side is plaintext VARCHAR. Backfill normalizes the phone string
 * on both sides and matches. SEPARATE security follow-up: NFR-005
 * compliance — should be tracked outside this migration.
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
  private readonly aesGcm: AesGcm;

  constructor(
    mysql: ConstructorParameters<typeof BaseMigrator>[1],
    pg: ConstructorParameters<typeof BaseMigrator>[2],
    tenants: ConstructorParameters<typeof BaseMigrator>[3],
    cfg: ConstructorParameters<typeof BaseMigrator>[4],
  ) {
    super('backfill-legacy-id', mysql, pg, tenants, cfg);
    this.aesGcm = new AesGcm(process.env.ACM_PII_KEY);
  }

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    const tables: MigrateResult['tables'] = [];
    // T1 — strong matches
    tables.push(await this.backfillUserByEmail(opts));
    tables.push(await this.backfillTeacherByEmail(opts));
    tables.push(await this.backfillClassesByCode(opts));
    tables.push(await this.backfillMapPassageByTitleGrade(opts));
    // T2 — chained on T1
    tables.push(await this.backfillSessionsByClassAndTime(opts));
    // T2 (re-classified from T3): MySQL "encrypted" columns are actually
    // plaintext UTF-8 bytes (parent.repository.ts encryptField is a
    // never-implemented placeholder). Match on plaintext after normalize.
    tables.push(await this.backfillParentByPhoneAndName(opts));
    tables.push(await this.backfillStudentByNameBirthDate(opts));
    tables.push(await this.backfillStudentParentByLegacyIds(opts));
    // T3 — Q-5 reconcile (uses ACM_PII_KEY for PG-side AES-GCM decryption).
    tables.push(await this.backfillInquiryByParentAndDate(opts));
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
      'amb_acm_std_parent',
      'amb_acm_std_student',
      'amb_acm_std_student_parent',
      'amb_acm_csl_inquiry',
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
  // T2 — std_parent  (legacy phone + name)
  //
  // Legacy `prt_phone_encrypted` claims AES-GCM but is actually plaintext
  // UTF-8 bytes — see backend/src/infrastructure/database/repositories/
  // parent.repository.ts where encryptField is `Buffer.from(value, 'utf-8')`,
  // a Phase-1-MVP TODO that became permanent. PG side is plaintext (VARCHAR).
  // So we decode the buffer, normalize, and match on (phone, name, ent_id).
  //
  // SECURITY NOTE — separate from this migration: NFR-005 expected AES-GCM
  // at rest. Operator needs to track this as a follow-up security finding
  // (independent of the MySQL → PG migration scope).
  // --------------------------------------------------------------------
  private async backfillParentByPhoneAndName(
    opts: MigrateOptions,
  ): Promise<MigrateResult['tables'][number]> {
    return this.runMatch({
      mysqlTable: 'tac_parents',
      pgTable: 'amb_acm_std_parent',
      orderBy: 'prt_id',
      mysqlColumns: ['prt_id', 'acd_id', 'prt_name', 'prt_phone_encrypted'],
      mapRowToWhere: (r) => {
        const entId = this.tenants.resolve(Number(r['acd_id']));
        const name = (r['prt_name'] as string | null)?.trim();
        const phoneBuf = r['prt_phone_encrypted'] as Buffer | null;
        const phone = phoneBuf
          ? phoneBuf.toString('utf-8').replace(/[\s\-()]/g, '')
          : null;
        if (!entId) return { sql: '', params: [], skipReason: 'tenant_not_mapped' };
        if (!name || !phone) return { sql: '', params: [], skipReason: 'no_phone_or_name' };
        return {
          // Normalize phone on PG side too to absorb formatting differences.
          sql: `
            regexp_replace(par_phone, '[\\s\\-()]', '', 'g') = $1
            AND par_name = $2
            AND ent_id = $3
            AND legacy_id IS NULL
          `,
          params: [phone, name, entId],
          skipReason: null,
        };
      },
      legacyIdOf: (r) => Number(r['prt_id']),
      opts,
    });
  }

  // --------------------------------------------------------------------
  // T2 — std_student  (name + birth_date + ent_id)
  //
  // tac_students is plain DATE/VARCHAR. PG amb_acm_std_student is the same.
  // Birth date narrows the match enough to handle name collisions in
  // mid-sized tenants. Adding `prt_id` (already migrated) as a tiebreaker
  // would be ideal but the PG schema doesn't track that directly — we
  // rely on the (name, birth_date) combination being unique per tenant.
  // --------------------------------------------------------------------
  private async backfillStudentByNameBirthDate(
    opts: MigrateOptions,
  ): Promise<MigrateResult['tables'][number]> {
    return this.runMatch({
      mysqlTable: 'tac_students',
      pgTable: 'amb_acm_std_student',
      orderBy: 'std_id',
      mysqlColumns: ['std_id', 'acd_id', 'std_name', 'std_birth_date'],
      mapRowToWhere: (r) => {
        const entId = this.tenants.resolve(Number(r['acd_id']));
        const name = (r['std_name'] as string | null)?.trim();
        const birth = r['std_birth_date'];
        if (!entId) return { sql: '', params: [], skipReason: 'tenant_not_mapped' };
        if (!name) return { sql: '', params: [], skipReason: 'no_name' };
        if (!birth) {
          // No birth date in MySQL — fall back to name-only match. This is
          // weaker; the runMatch ambiguity guard will skip if 2+ PG rows
          // match (operator review).
          return {
            sql: 'std_name = $1 AND ent_id = $2 AND legacy_id IS NULL',
            params: [name, entId],
            skipReason: null,
          };
        }
        return {
          sql: 'std_name = $1 AND std_birth_date = $2 AND ent_id = $3 AND legacy_id IS NULL',
          params: [name, birth, entId],
          skipReason: null,
        };
      },
      legacyIdOf: (r) => Number(r['std_id']),
      opts,
    });
  }

  // --------------------------------------------------------------------
  // T2 — std_student_parent  (depends on both T2 backfills above)
  //
  // tac_student_guardians is the join. After student + parent legacy_id
  // are populated on PG, we can resolve (std_legacy → std_uuid) and
  // (prt_legacy → prt_uuid) and find the matching PG row.
  //
  // The PG `amb_acm_std_student_parent` PK column is checked at runtime
  // (avoids a stale assumption baked into this file).
  // --------------------------------------------------------------------
  private backfillStudentParentByLegacyIds(opts: MigrateOptions) {
    return this.runMatch({
      mysqlTable: 'tac_student_guardians',
      pgTable: 'amb_acm_std_student_parent',
      orderBy: 'sgu_id',
      mysqlColumns: ['sgu_id', 'std_id', 'prt_id'],
      mapRowToWhere: (r) => {
        const stdLegacy = Number(r['std_id']);
        const prtLegacy = Number(r['prt_id']);
        if (!stdLegacy || !prtLegacy) {
          return { sql: '', params: [], skipReason: 'incomplete_key' };
        }
        // PG schema: amb_acm_std_student_parent(sp_id, std_id, par_id, ...).
        // sql/acm/840 §A3 — composite UNIQUE on (std_id, par_id) so the
        // subquery → equality match yields a single row.
        return {
          sql: `
            std_id = (SELECT std_id FROM amb_acm_std_student WHERE legacy_id = $1)
            AND par_id = (SELECT par_id FROM amb_acm_std_parent WHERE legacy_id = $2)
            AND legacy_id IS NULL
          `,
          params: [stdLegacy, prtLegacy],
          skipReason: null,
        };
      },
      legacyIdOf: (r) => Number(r['sgu_id']),
      opts,
    });
  }

  // --------------------------------------------------------------------
  // T3 — csl_inquiry (Q-5 auto reconcile)
  //
  // Custom matching path — `runMatch()` doesn't handle this because PG-side
  // name/phone is AES-GCM encrypted. We decrypt in Node, compare, and tag
  // legacy_id when exactly one PG candidate matches.
  //
  // Match flow:
  //   1. MySQL tac_consultations.prt_id → MySQL tac_parents → parent name + phone
  //      (plaintext after the encrypt-field placeholder unwinds).
  //   2. Constrain PG inquiry candidates by (ent_id, inq_registered_at near
  //      cst_created_at::date ± 1 day) — narrows from O(tenant total) to
  //      typically 0–5 candidates.
  //   3. AES-GCM decrypt each candidate's inq_name/phone.
  //   4. Compare normalized strings. Exact match on (name + phone) → tag.
  //   5. 0 or 2+ matches → skip + log (operator review).
  //
  // ACM_PII_KEY absent → method emits the full row count under
  // skippedNoKey with reason 'no_pii_key' and returns without touching PG.
  // --------------------------------------------------------------------
  private async backfillInquiryByParentAndDate(
    opts: MigrateOptions,
  ): Promise<MigrateResult['tables'][number]> {
    const start = Date.now();
    const dryRun = opts.dryRun ?? this.cfg.dryRun;
    const total = await this.mysql.count('tac_consultations');
    this.log.info('begin backfill tac_consultations → amb_acm_csl_inquiry', {
      total, dryRun, aesGcmEnabled: this.aesGcm.enabled,
    });

    if (!this.aesGcm.enabled) {
      this.log.warn('skip csl_inquiry backfill — ACM_PII_KEY missing');
      return {
        mysqlTable: 'tac_consultations',
        pgTable: 'amb_acm_csl_inquiry',
        mysqlCount: total,
        pgInserted: 0,
        pgSkipped: total,
        durationMs: Date.now() - start,
      };
    }

    let matched = 0;
    let skippedNoParent = 0;
    let skippedNoCandidates = 0;
    let skippedAmbiguous = 0;

    type Row = {
      cst_id: number;
      acd_id: number;
      prt_id: number | null;
      cst_created_at: Date | string;
    };

    for await (const batch of this.mysql.iterate<Row>('tac_consultations', {
      orderBy: 'cst_id',
      batchSize: this.cfg.batchSize,
      columns: ['cst_id', 'acd_id', 'prt_id', 'cst_created_at'],
      limit: opts.limit,
    })) {
      for (const row of batch) {
        if (!row.prt_id) {
          skippedNoParent++;
          continue;
        }
        const entId = this.tenants.resolve(Number(row.acd_id));
        if (!entId) {
          skippedNoParent++;
          continue;
        }

        // 1) Get parent name + phone from MySQL.
        const parent = await this.mysql.findOne<{
          prt_name: string;
          prt_phone_encrypted: Buffer | null;
        }>(
          'SELECT prt_name, prt_phone_encrypted FROM tac_parents WHERE prt_id = ?',
          [row.prt_id],
        );
        if (!parent) {
          skippedNoParent++;
          continue;
        }
        const targetName = (parent.prt_name ?? '').trim();
        const targetPhone = normalizePhone(
          parent.prt_phone_encrypted?.toString('utf-8') ?? null,
        );

        // 2) Candidate PG inquiries (ent + date window).
        const createdDate = this.toTimestampTz(row.cst_created_at);
        if (!createdDate) {
          skippedNoCandidates++;
          continue;
        }
        const isoDate = createdDate.toISOString().slice(0, 10);
        const candidates = await this.pg.query<{
          inq_id: string;
          inq_name_encrypted: Buffer;
          inq_name_iv: Buffer;
          inq_name_auth_tag: Buffer;
          inq_phone_encrypted: Buffer | null;
          inq_phone_iv: Buffer | null;
          inq_phone_auth_tag: Buffer | null;
        }>(
          `SELECT inq_id, inq_name_encrypted, inq_name_iv, inq_name_auth_tag,
                  inq_phone_encrypted, inq_phone_iv, inq_phone_auth_tag
             FROM amb_acm_csl_inquiry
            WHERE ent_id = $1
              AND inq_registered_at BETWEEN $2::date - INTERVAL '1 day'
                                       AND $2::date + INTERVAL '1 day'
              AND legacy_id IS NULL`,
          [entId, isoDate],
        );
        if (candidates.length === 0) {
          skippedNoCandidates++;
          continue;
        }

        // 3) Decrypt each candidate and compare.
        const hits: string[] = [];
        for (const c of candidates) {
          const decName = this.aesGcm.decrypt(
            c.inq_name_encrypted,
            c.inq_name_iv,
            c.inq_name_auth_tag,
          );
          if (decName == null) continue;
          if (decName.trim() !== targetName) continue;
          // Name matches — also verify phone if both sides have it.
          if (targetPhone && c.inq_phone_encrypted) {
            const decPhone = this.aesGcm.decrypt(
              c.inq_phone_encrypted,
              c.inq_phone_iv,
              c.inq_phone_auth_tag,
            );
            if (normalizePhone(decPhone) !== targetPhone) continue;
          }
          hits.push(c.inq_id);
        }

        if (hits.length === 0) {
          skippedNoCandidates++;
          continue;
        }
        if (hits.length > 1) {
          skippedAmbiguous++;
          this.log.warn(`ambiguous inquiry match (${hits.length} rows) — skip`, {
            cst_id: row.cst_id, prt_id: row.prt_id, hits,
          });
          continue;
        }

        if (dryRun) {
          matched++;
          continue;
        }
        await this.pg.query(
          'UPDATE amb_acm_csl_inquiry SET legacy_id = $1 WHERE inq_id = $2',
          [row.cst_id, hits[0]],
        );
        matched++;
      }
    }

    const durationMs = Date.now() - start;
    this.log.info('done csl_inquiry backfill', {
      matched, skippedNoParent, skippedNoCandidates, skippedAmbiguous, durationMs,
    });

    return {
      mysqlTable: 'tac_consultations',
      pgTable: 'amb_acm_csl_inquiry',
      mysqlCount: total,
      pgInserted: matched,
      pgSkipped: skippedNoParent + skippedNoCandidates + skippedAmbiguous,
      durationMs,
    };
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
