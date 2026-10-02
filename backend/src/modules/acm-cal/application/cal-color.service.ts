import { normalizeCalCategory } from './cal-category';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { CAL_CATEGORIES } from './dto/cal-event.dto';
export const PALETTES = [
  'blue',
  'purple',
  'amber',
  'green',
  'rose',
  'cyan',
  'orange',
  'gray',
] as const;
export interface CalendarColor {
  kind: 'CATEGORY' | 'ASSIGNEE';
  target: string;
  palette: string;
}
@Injectable()
export class CalColorService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  async list(entId: string): Promise<CalendarColor[]> {
    const rows: CalendarColor[] = await this.ds.query(
      `SELECT ccs_kind AS kind,ccs_target AS target,ccs_palette AS palette FROM amb_acm_cal_color_setting c WHERE ent_id=$1 AND (ccs_kind='CATEGORY' OR EXISTS (SELECT 1 FROM amb_acm_tch_teacher t WHERE t.ent_id=c.ent_id AND t.tch_id::text=c.ccs_target AND t.deleted_at IS NULL))`,
      [entId],
    );
    const normalized = new Map<string, CalendarColor>();
    // Canonical category color wins over a legacy alias.
    for (const row of rows.sort(
      (a, b) =>
        Number(a.target === normalizeCalCategory(a.target)) -
        Number(b.target === normalizeCalCategory(b.target)),
    )) {
      const target =
        row.kind === 'CATEGORY' ? normalizeCalCategory(row.target) : row.target;
      normalized.set(`${row.kind}:${target}`, { ...row, target });
    }
    return [...normalized.values()];
  }
  async save(entId: string, items: CalendarColor[]) {
    await this.ds.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `cal-colors:${entId}`,
      ]);
      for (const item of items) {
        if (!PALETTES.includes(item.palette as (typeof PALETTES)[number]))
          throw new BadRequestException('INVALID_PALETTE');
        if (item.kind === 'CATEGORY') {
          if (
            !CAL_CATEGORIES.includes(
              item.target as (typeof CAL_CATEGORIES)[number],
            )
          )
            throw new BadRequestException('INVALID_CATEGORY');
        } else {
          if (!/^[0-9a-f-]{36}$/i.test(item.target))
            throw new BadRequestException('INVALID_TEACHER');
          const rows = await m.query<{ tch_id: string }[]>(
            'SELECT tch_id FROM amb_acm_tch_teacher WHERE ent_id=$1 AND tch_id=$2 AND deleted_at IS NULL',
            [entId, item.target],
          );
          if (!rows.length) throw new BadRequestException('INVALID_TEACHER');
        }
      }
      await m.query('DELETE FROM amb_acm_cal_color_setting WHERE ent_id=$1', [
        entId,
      ]);
      for (const i of items)
        await m.query(
          'INSERT INTO amb_acm_cal_color_setting(ent_id,ccs_kind,ccs_target,ccs_palette) VALUES($1,$2,$3,$4) ON CONFLICT(ent_id,ccs_kind,ccs_target) DO UPDATE SET ccs_palette=EXCLUDED.ccs_palette,updated_at=now()',
          [entId, i.kind, i.target, i.palette],
        );
    });
    return this.list(entId);
  }
}
