import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { isUUID } from 'class-validator';
import { ACM_DS } from '../../acm-common/datasource';
import {
  calculateOperating,
  ManualValue,
  OPS_METRICS,
  Period,
} from './operating-calculation';
export const OPERATING_PERIOD_SQL = `
WITH periods AS (
 SELECT p.opr_id::text id,p.kind,p.subject_id::text AS "subjectId",p.site,p.start_date::text start,p.end_date::text "end",p.confirmed,p.revision,p.cancelled
 FROM amb_acm_dsh_operating_period p
 WHERE p.ent_id=$1 AND (p.subject_id IS NULL OR
 (p.kind='STUDENT' AND EXISTS(SELECT 1 FROM amb_acm_std_student s WHERE s.std_id=p.subject_id AND s.ent_id=p.ent_id AND s.deleted_at IS NULL)) OR
 (p.kind='TEACHER' AND EXISTS(SELECT 1 FROM amb_acm_tch_teacher t WHERE t.tch_id=p.subject_id AND t.ent_id=p.ent_id AND t.deleted_at IS NULL AND t.tch_is_instructor)))
 UNION ALL
 SELECT NULL,'STUDENT',s.std_id::text,s.std_site,s.std_start_date::text,s.std_end_date::text,true,0,false
 FROM amb_acm_std_student s WHERE s.ent_id=$1 AND s.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM amb_acm_dsh_operating_period p WHERE p.ent_id=s.ent_id AND p.kind='STUDENT' AND p.subject_id=s.std_id)
 UNION ALL
 SELECT NULL,'TEACHER',t.tch_id::text,NULL,t.tch_hired_at::text,t.tch_ended_at::text,(t.tch_status<>'RESIGNED' OR t.tch_ended_at IS NOT NULL),0,false
 FROM amb_acm_tch_teacher t WHERE t.ent_id=$1 AND t.deleted_at IS NULL AND t.tch_is_instructor AND NOT EXISTS(SELECT 1 FROM amb_acm_dsh_operating_period p WHERE p.ent_id=t.ent_id AND p.kind='TEACHER' AND p.subject_id=t.tch_id)
)
`;
export function validateOpsDate(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Invalid ISO date');
}
export function validateOpsSite(site: string) {
  if (!['ALL', 'TPI', 'TRINITY', 'SANTACROCE'].includes(site))
    throw new BadRequestException('Invalid site');
}
@Injectable()
export class OperatingService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  async range(entId: string, from: string, to: string, site = 'ALL') {
    validateOpsDate(from);
    validateOpsDate(to);
    validateOpsSite(site);
    if (
      from > to ||
      from < '2024-12-02' ||
      (Date.parse(to) - Date.parse(from)) / 86400000 >= 1096
    )
      throw new BadRequestException(
        'Range must start on/after 2024-12-02 and be at most 1096 days',
      );
    const [raw] = await this.ds.query<
      {
        periods: Period[];
        manual: ManualValue[];
        today: string;
        asOf: string;
        unverifiedManual: number;
      }[]
    >(
      OPERATING_PERIOD_SQL +
        `SELECT COALESCE((SELECT json_agg(p) FROM periods p),'[]') periods, COALESCE((SELECT json_agg(m) FROM (SELECT date::text,site,metric,value FROM amb_acm_dsh_operating_manual WHERE ent_id=$1 AND date BETWEEN $2::date AND $3::date) m),'[]') manual, (SELECT count(*)::int FROM amb_acm_dsh_daily_kpi k CROSS JOIN (VALUES('ops_new_st'),('ops_out_st'),('ops_count_st'),('ops_new_tc'),('ops_out_tc'),('ops_count_tc')) v(metric) WHERE k.ent_id=$1 AND k.dkp_date BETWEEN $2::date AND $3::date AND k.dkp_manually_overridden AND NOT EXISTS(SELECT 1 FROM amb_acm_dsh_operating_manual m WHERE m.ent_id=k.ent_id AND m.date=k.dkp_date AND m.site='ALL' AND m.metric=v.metric)) AS "unverifiedManual", (now() AT TIME ZONE 'Asia/Seoul')::date::text today,now()::text AS "asOf"`,
      [entId, from, to],
    );
    const calculated = calculateOperating(
      raw.periods,
      raw.manual,
      from,
      to,
      site,
      raw.today,
    );
    return {
      ...calculated,
      asOf: raw.asOf,
      quality: {
        ...calculated.quality,
        unverifiedManual: site === 'ALL' ? raw.unverifiedManual : 0,
      },
    };
  }
  async list(entId: string, kind: string, subjectId: string) {
    if (!['STUDENT', 'TEACHER'].includes(kind))
      throw new BadRequestException('Invalid kind');
    return this.ds.query<Period[]>(
      OPERATING_PERIOD_SQL +
        'SELECT * FROM periods WHERE kind=$2 AND "subjectId"=$3 ORDER BY start NULLS LAST',
      [entId, kind, subjectId],
    );
  }
  async savePeriod(
    entId: string,
    actor: string,
    kind: string,
    subjectId: string,
    body: {
      id?: string;
      start: string;
      end?: string | null;
      site?: string | null;
      revision?: number;
      cancelled?: boolean;
      replaceMaster?: boolean;
    },
  ) {
    if (!['STUDENT', 'TEACHER'].includes(kind))
      throw new BadRequestException('Invalid kind');
    if (
      !body ||
      (body.id && !isUUID(body.id)) ||
      (body.id && !Number.isInteger(body.revision)) ||
      (body.cancelled !== undefined && typeof body.cancelled !== 'boolean')
    )
      throw new BadRequestException('Invalid period');
    validateOpsDate(body.start);
    if (body.end) validateOpsDate(body.end);
    if (body.end && body.end < body.start)
      throw new BadRequestException('End precedes start');
    if (body.site) validateOpsSite(body.site);
    if (body.site === 'ALL')
      throw new BadRequestException('Period needs one site');
    return this.ds.transaction(async (em) => {
      const table =
        kind === 'STUDENT' ? 'amb_acm_std_student' : 'amb_acm_tch_teacher';
      const pk = kind === 'STUDENT' ? 'std_id' : 'tch_id';
      const subject = await em.query<{ id: string }[]>(
        `SELECT ${pk} FROM ${table} WHERE ent_id=$1 AND ${pk}=$2 AND deleted_at IS NULL FOR UPDATE`,
        [entId, subjectId],
      );
      if (!subject.length) throw new NotFoundException();
      const overlaps = await em.query<{ opr_id: string }[]>(
        `SELECT opr_id FROM amb_acm_dsh_operating_period WHERE ent_id=$1 AND kind=$2 AND subject_id=$3 AND NOT cancelled AND confirmed AND opr_id IS DISTINCT FROM $4::uuid AND daterange(start_date,end_date,'[)') && daterange($5::date,$6::date,'[)')`,
        [entId, kind, subjectId, body.id ?? null, body.start, body.end || null],
      );
      if (!body.cancelled && overlaps.length)
        throw new ConflictException('Overlapping period');
      if (body.id) {
        const result = await em.query<{ opr_id: string }[]>(
          `WITH changed AS (UPDATE amb_acm_dsh_operating_period SET start_date=$5,end_date=$6,site=$7,cancelled=$8,actor_id=$9,revision=revision+1,updated_at=now() WHERE ent_id=$1 AND kind=$2 AND subject_id=$3 AND opr_id=$4 AND revision=$10 RETURNING opr_id) SELECT * FROM changed`,
          [
            entId,
            kind,
            subjectId,
            body.id,
            body.start,
            body.end || null,
            body.site || null,
            body.cancelled ?? false,
            actor,
            body.revision,
          ],
        );
        if (!result.length)
          throw new ConflictException('Period changed; reload');
      } else {
        if (!body.replaceMaster) {
          const startCol =
            kind === 'STUDENT' ? 'std_start_date' : 'tch_hired_at';
          const endCol = kind === 'STUDENT' ? 'std_end_date' : 'tch_ended_at';
          const siteCol = kind === 'STUDENT' ? 'std_site' : 'NULL';
          await em.query(
            `INSERT INTO amb_acm_dsh_operating_period(ent_id,kind,subject_id,site,start_date,end_date,source_key,actor_id) SELECT ent_id,$2,${pk},${siteCol},${startCol},${endCol},'master:'||${pk}::text,$4 FROM ${table} WHERE ent_id=$1 AND ${pk}=$3 AND ${startCol} IS NOT NULL AND NOT EXISTS(SELECT 1 FROM amb_acm_dsh_operating_period WHERE ent_id=$1 AND kind=$2 AND subject_id=$3) ON CONFLICT DO NOTHING`,
            [entId, kind, subjectId, actor],
          );
          const conflict = await em.query<{ opr_id: string }[]>(
            `SELECT opr_id FROM amb_acm_dsh_operating_period WHERE ent_id=$1 AND kind=$2 AND subject_id=$3 AND NOT cancelled AND confirmed AND daterange(start_date,end_date,'[)') && daterange($4::date,$5::date,'[)')`,
            [entId, kind, subjectId, body.start, body.end || null],
          );
          if (conflict.length)
            throw new ConflictException('Close or edit existing period first');
        }
        await em.query(
          `INSERT INTO amb_acm_dsh_operating_period(ent_id,kind,subject_id,site,start_date,end_date,source_key,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            entId,
            kind,
            subjectId,
            body.site || null,
            body.start,
            body.end || null,
            'ui:' + randomUUID(),
            actor,
          ],
        );
      }
      return { saved: true };
    });
  }
  async saveManual(
    entId: string,
    actor: string,
    date: string,
    site: string,
    values: Record<string, unknown>,
  ) {
    validateOpsDate(date);
    validateOpsSite(site);
    if (!values || typeof values !== 'object' || Array.isArray(values))
      throw new BadRequestException('Invalid values');
    const entries = Object.entries(values);
    if (
      !entries.length ||
      entries.some(
        ([k, v]) =>
          !OPS_METRICS.includes(k as (typeof OPS_METRICS)[number]) ||
          (site !== 'ALL' && k.endsWith('_tc')) ||
          (v !== null &&
            (typeof v !== 'number' ||
              !Number.isSafeInteger(v) ||
              v < 0 ||
              v > 1e9)),
      )
    )
      throw new BadRequestException('Invalid manual metrics');
    await this.ds.transaction(async (em) => {
      for (const [metric, value] of entries)
        await em.query(
          `INSERT INTO amb_acm_dsh_operating_manual(ent_id,date,site,metric,value,source,actor_id) VALUES($1,$2,$3,$4,$5,'ui',$6) ON CONFLICT(ent_id,date,site,metric) DO UPDATE SET value=EXCLUDED.value,source=EXCLUDED.source,actor_id=EXCLUDED.actor_id,updated_at=now()`,
          [entId, date, site, metric, value, actor],
        );
    });
    return { saved: true };
  }
}
