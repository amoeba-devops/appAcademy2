import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  ACTIVE_CAL_CATEGORIES,
  CAL_CATEGORY_CODE_RE,
  SEEDED_CAL_CATEGORIES,
  isSystemCalCategory,
} from './cal-category';
import { isCalColor } from './cal-color.service';

/** REQ-261128-CAL — tenant calendar categories (system 5 + editable ones). */
export interface CalCategoryView {
  code: string;
  /** Custom name; null → show the translated label for `code`. */
  name: string | null;
  system: boolean;
  inStats: boolean;
  sortOrder: number;
  /** `#RRGGBB` (or a legacy palette name) from the color settings; null = default. */
  color: string | null;
  active: boolean;
  eventCount: number;
}

export interface CalCategoryInput {
  code?: string;
  name?: string | null;
  color?: string | null;
  inStats?: boolean;
  sortOrder?: number;
}

interface Row {
  code: string;
  name: string | null;
  system: boolean;
  inStats: boolean;
  sortOrder: number;
  color: string | null;
  deletedAt: Date | null;
  eventCount: string | number;
}

export const CAL_CATEGORY_NAME_MAX = 40;

@Injectable()
export class CalCategoryService {
  private readonly seeded = new Set<string>();

  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  /** Idempotent: inserts the default rows a tenant is missing (deleted rows stay deleted). */
  async ensureDefaults(entId: string, m: EntityManager = this.ds.manager) {
    if (this.seeded.has(entId)) return;
    const defaults = [
      ...ACTIVE_CAL_CATEGORIES.map((code, i) => ({ code, system: true, inStats: true, order: i })),
      ...SEEDED_CAL_CATEGORIES.map((code, i) => ({
        code,
        system: false,
        inStats: false,
        order: ACTIVE_CAL_CATEGORIES.length + i,
      })),
    ];
    await m.query(
      `INSERT INTO amb_acm_cal_category (ent_id, cct_code, cct_is_system, cct_in_stats, cct_sort_order)
       SELECT $1::uuid, d.code, d.sys, d.st, d.ord
         FROM unnest($2::text[], $3::boolean[], $4::boolean[], $5::int[]) AS d(code, sys, st, ord)
       ON CONFLICT (ent_id, cct_code) DO NOTHING`,
      [
        entId,
        defaults.map((d) => d.code),
        defaults.map((d) => d.system),
        defaults.map((d) => d.inStats),
        defaults.map((d) => d.order),
      ],
    );
    this.seeded.add(entId);
  }

  /** All categories incl. deleted ones (old events still show their name/color). */
  async list(entId: string, withCounts = true): Promise<CalCategoryView[]> {
    await this.ensureDefaults(entId);
    const rows: Row[] = await this.ds.query(
      `SELECT c.cct_code AS code, c.cct_name AS name, c.cct_is_system AS system,
              c.cct_in_stats AS "inStats", c.cct_sort_order AS "sortOrder",
              s.ccs_palette AS color, c.deleted_at AS "deletedAt",
              CASE WHEN $2::boolean THEN
                (SELECT count(*) FROM amb_acm_cal_event e
                  WHERE e.ent_id = c.ent_id AND e.deleted_at IS NULL
                    AND e.evt_category = c.cct_code)
              ELSE 0 END AS "eventCount"
         FROM amb_acm_cal_category c
         LEFT JOIN amb_acm_cal_color_setting s
           ON s.ent_id = c.ent_id AND s.ccs_kind = 'CATEGORY' AND s.ccs_target = c.cct_code
        WHERE c.ent_id = $1
        ORDER BY (c.deleted_at IS NOT NULL), c.cct_sort_order, c.created_at`,
      [entId, withCounts],
    );
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      system: r.system,
      inStats: r.inStats,
      sortOrder: r.sortOrder,
      color: r.color,
      active: !r.deletedAt,
      eventCount: Number(r.eventCount),
    }));
  }

  /** Codes whose events are left out of the class statistics. */
  async statsExcluded(entId: string): Promise<Set<string>> {
    await this.ensureDefaults(entId);
    const rows: { code: string }[] = await this.ds.query(
      `SELECT cct_code AS code FROM amb_acm_cal_category
        WHERE ent_id = $1 AND cct_in_stats = false`,
      [entId],
    );
    return new Set(rows.map((r) => r.code));
  }

  /**
   * Rejects codes the tenant cannot use. `previous` lets an event keep the
   * category it already has, even after that category was deleted;
   * `allowDeleted` is for copies of existing events (recurrence generation).
   */
  async assertUsable(
    entId: string,
    code: string | undefined,
    opts: { previous?: string; allowDeleted?: boolean } = {},
  ) {
    if (code === undefined || code === opts.previous || isSystemCalCategory(code))
      return;
    await this.ensureDefaults(entId);
    const rows: unknown[] = await this.ds.query(
      `SELECT 1 FROM amb_acm_cal_category
        WHERE ent_id = $1 AND cct_code = $2 AND ($3::boolean OR deleted_at IS NULL)`,
      [entId, code, opts.allowDeleted === true],
    );
    if (!rows.length) throw new BadRequestException('INVALID_CATEGORY');
  }

  /** Upserts the given rows (no code = new). Rows not listed are left as they are. */
  async save(entId: string, items: CalCategoryInput[]) {
    await this.ds.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`cal-categories:${entId}`]);
      await this.ensureDefaults(entId, m);
      const existing: { code: string; system: boolean; deleted: boolean }[] = await m.query(
        `SELECT cct_code AS code, cct_is_system AS system, deleted_at IS NOT NULL AS deleted
           FROM amb_acm_cal_category WHERE ent_id = $1`,
        [entId],
      );
      const byCode = new Map(existing.map((r) => [r.code, r]));
      const names = new Set<string>();
      for (const item of items) {
        if (item.color != null && !isCalColor(item.color))
          throw new BadRequestException('INVALID_COLOR');
        const row = item.code ? byCode.get(item.code) : undefined;
        if (item.code && (!row || row.deleted))
          throw new NotFoundException('CATEGORY_NOT_FOUND');
        if (row?.system) {
          if (item.name != null && item.name !== '')
            throw new UnprocessableEntityException('SYSTEM_CATEGORY_NAME_FIXED');
          if (item.inStats === false)
            throw new UnprocessableEntityException('SYSTEM_CATEGORY_IN_STATS');
          continue;
        }
        const name = item.name?.trim() ?? '';
        // Seeded rows may keep the translated label (name = null).
        if (!name && !(row && (SEEDED_CAL_CATEGORIES as readonly string[]).includes(row.code)))
          throw new BadRequestException('CATEGORY_NAME_REQUIRED');
        if (name.length > CAL_CATEGORY_NAME_MAX)
          throw new BadRequestException('CATEGORY_NAME_TOO_LONG');
        if (name) {
          if (names.has(name)) throw new BadRequestException('CATEGORY_NAME_DUPLICATE');
          names.add(name);
        }
      }

      for (const item of items) {
        let code = item.code;
        const row = code ? byCode.get(code) : undefined;
        const name = row?.system ? null : item.name?.trim() || null;
        if (!code) {
          code = newCategoryCode();
          await m.query(
            `INSERT INTO amb_acm_cal_category
               (ent_id, cct_code, cct_name, cct_is_system, cct_in_stats, cct_sort_order)
             VALUES ($1, $2, $3, false, $4, $5)`,
            [entId, code, name, item.inStats ?? true, item.sortOrder ?? 999],
          );
        } else {
          await m.query(
            `UPDATE amb_acm_cal_category
                SET cct_name = CASE WHEN cct_is_system THEN NULL ELSE $3 END,
                    cct_in_stats = CASE WHEN cct_is_system THEN true ELSE COALESCE($4, cct_in_stats) END,
                    cct_sort_order = COALESCE($5, cct_sort_order)
              WHERE ent_id = $1 AND cct_code = $2`,
            [entId, code, name, item.inStats ?? null, item.sortOrder ?? null],
          );
        }
        if (item.color === null) {
          await m.query(
            `DELETE FROM amb_acm_cal_color_setting
              WHERE ent_id = $1 AND ccs_kind = 'CATEGORY' AND ccs_target = $2`,
            [entId, code],
          );
        } else if (item.color !== undefined) {
          await m.query(
            `INSERT INTO amb_acm_cal_color_setting (ent_id, ccs_kind, ccs_target, ccs_palette)
             VALUES ($1, 'CATEGORY', $2, $3)
             ON CONFLICT (ent_id, ccs_kind, ccs_target)
             DO UPDATE SET ccs_palette = EXCLUDED.ccs_palette, updated_at = now()`,
            [entId, code, item.color.toLowerCase()],
          );
        }
      }
    });
    return this.list(entId);
  }

  /** Soft delete: hidden from new events, existing events keep it. */
  async remove(entId: string, code: string) {
    if (!CAL_CATEGORY_CODE_RE.test(code)) throw new NotFoundException('CATEGORY_NOT_FOUND');
    if (isSystemCalCategory(code))
      throw new UnprocessableEntityException('SYSTEM_CATEGORY_UNDELETABLE');
    await this.ensureDefaults(entId);
    const [rows] = (await this.ds.query(
      `UPDATE amb_acm_cal_category SET deleted_at = now()
        WHERE ent_id = $1 AND cct_code = $2 AND deleted_at IS NULL AND cct_is_system = false
        RETURNING cct_code`,
      [entId, code],
    )) as [unknown[], number];
    if (!rows.length) throw new NotFoundException('CATEGORY_NOT_FOUND');
    const [{ n }]: { n: string }[] = await this.ds.query(
      `SELECT count(*) AS n FROM amb_acm_cal_event
        WHERE ent_id = $1 AND evt_category = $2 AND deleted_at IS NULL`,
      [entId, code],
    );
    return { code, eventCount: Number(n) };
  }
}

function newCategoryCode() {
  return `C_${randomBytes(4).toString('hex').toUpperCase()}`;
}
