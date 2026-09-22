import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { isDshSite, parseSiteParam } from './dsh-site.util';
import {
  compareVisitors,
  visitorDate,
  visitorDays,
} from './visitor-comparison';
import type { VisitorObservation } from '../types/visitor-comparison';

const SELECT_OBSERVATION = `vob_id AS id, vob_date::text AS date, vob_site AS site,
 vob_source AS source, vob_definition AS definition, vob_metric AS metric,
 vob_timezone AS timezone, vob_value AS value, vob_note AS note,
 vob_revision AS revision, updated_at::text AS "updatedAt"`;
export interface ImwebInput {
  site: unknown;
  value: unknown;
  note: unknown;
  timezone: unknown;
  revision: unknown;
}
export interface GaObservationInput {
  site: string;
  date: string;
  value: number;
  metric: string;
  propertyId: string;
  streamId: string;
}
@Injectable()
export class VisitorComparisonService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async range(entId: string, from: string, to: string, rawSite?: string) {
    visitorDays(from, to);
    const site = parseSiteParam(rawSite);
    const originals: VisitorObservation[] = await this.ds.query(
      `SELECT DISTINCT ON (vob_date,vob_site,vob_source) ${SELECT_OBSERVATION}
       FROM amb_acm_dsh_visit_observation WHERE ent_id=$1 AND vob_date BETWEEN $2 AND $3
       AND ($4::text IS NULL OR vob_site=$4)
       ORDER BY vob_date,vob_site,vob_source,updated_at DESC,vob_id DESC`,
      [entId, from, to, site ?? null],
    );
    // Do not infer old GA metric from today's config. New observations supersede this display-only fallback.
    const legacy: VisitorObservation[] = await this.ds.query(
      `SELECT svt_id AS id,svt_date::text AS date,svt_site AS site,'GA4' AS source,
       'LEGACY_UNKNOWN' AS definition,'unknown' AS metric,'UNKNOWN' AS timezone,
       svt_visitors AS value,'' AS note,0 AS revision,svt_synced_at::text AS "updatedAt"
       FROM amb_acm_dsh_site_visit WHERE ent_id=$1 AND svt_date BETWEEN $2 AND $3
       AND svt_source='GA4' AND ($4::text IS NULL OR svt_site=$4)`,
      [entId, from, to, site ?? null],
    );
    return compareVisitors(from, to, site, [...legacy, ...originals]);
  }

  async saveImweb(
    entId: string,
    actorId: string,
    date: string,
    body: ImwebInput,
  ) {
    visitorDate(date);
    if (
      !body ||
      !isDshSite(body.site) ||
      !(
        body.value === null ||
        (typeof body.value === 'number' &&
          Number.isInteger(body.value) &&
          body.value >= 0 &&
          body.value <= 2147483647)
      ) ||
      typeof body.revision !== 'number' ||
      !Number.isInteger(body.revision) ||
      body.revision < 0 ||
      body.revision >= 2147483647 ||
      typeof body.note !== 'string' ||
      !body.note.trim() ||
      body.note.length > 500 ||
      typeof body.timezone !== 'string' ||
      body.timezone.length > 80
    )
      throw new BadRequestException(
        '사이트, 방문자 수, 자료 설명, 시간대 및 수정 버전을 확인하세요.',
      );
    try {
      new Intl.DateTimeFormat('en', { timeZone: body.timezone }).format();
    } catch {
      throw new BadRequestException('유효한 IANA 시간대를 입력하세요.');
    }
    const params = [
      entId,
      body.site,
      date,
      body.value,
      body.note.trim(),
      body.timezone,
      actorId,
      body.revision,
    ];
    // Atomic compare-and-swap. revision=0 only permits create; never recreates stale deleted data.
    const result: VisitorObservation[] =
      body.revision === 0
        ? await this.ds.query(
            `INSERT INTO amb_acm_dsh_visit_observation
        (ent_id,vob_site,vob_date,vob_source,vob_definition,vob_metric,vob_timezone,vob_value,vob_note,vob_actor_id)
        VALUES($1,$2,$3,'IMWEB','imweb-daily-v1','visitors',$6,$4,$5,$7)
        ON CONFLICT DO NOTHING RETURNING ${SELECT_OBSERVATION}`,
            params.slice(0, 7),
          )
        : await this.ds.query(
            `UPDATE amb_acm_dsh_visit_observation SET vob_value=$4,vob_note=$5,vob_timezone=$6,
        vob_actor_id=$7,vob_revision=vob_revision+1,updated_at=clock_timestamp()
        WHERE ent_id=$1 AND vob_site=$2 AND vob_date=$3 AND vob_source='IMWEB'
        AND vob_definition='imweb-daily-v1' AND vob_revision=$8 RETURNING ${SELECT_OBSERVATION}`,
            params,
          );
    // TypeORM raw UPDATE returns [rows, count]. INSERT returns rows.
    const rows =
      body.revision === 0
        ? result
        : (result as unknown as [VisitorObservation[], number])[0];
    if (!rows.length)
      throw new ConflictException(
        '다른 작업에서 변경되었습니다. 다시 조회한 후 저장하세요.',
      );
    return rows[0];
  }

  async recordGa(entId: string, o: GaObservationInput) {
    visitorDate(o.date);
    if (
      !isDshSite(o.site) ||
      !Number.isInteger(o.value) ||
      o.value < 0 ||
      o.value > 2147483647
    )
      throw new BadRequestException('Invalid GA observation');
    const definition = JSON.stringify([
      'ga4-daily-v1',
      o.propertyId,
      o.streamId,
      o.metric,
    ]);
    await this.ds.query(
      `INSERT INTO amb_acm_dsh_visit_observation
      (ent_id,vob_site,vob_date,vob_source,vob_definition,vob_metric,vob_timezone,vob_value,vob_note)
      VALUES($1,$2,$3,'GA4',$4,$5,'UNKNOWN',$6,'')
      ON CONFLICT(ent_id,vob_site,vob_date,vob_source,vob_definition) DO UPDATE
      SET vob_value=EXCLUDED.vob_value,vob_revision=amb_acm_dsh_visit_observation.vob_revision+1,updated_at=clock_timestamp()
      WHERE amb_acm_dsh_visit_observation.vob_value IS DISTINCT FROM EXCLUDED.vob_value
      OR EXISTS (SELECT 1 FROM amb_acm_dsh_visit_observation newer
        WHERE newer.ent_id=$1 AND newer.vob_site=$2 AND newer.vob_date=$3 AND newer.vob_source='GA4'
        AND newer.vob_definition<>$4 AND newer.updated_at>=amb_acm_dsh_visit_observation.updated_at)`,
      [entId, o.site, o.date, definition, o.metric, o.value],
    );
  }

  async history(entId: string, date: string, site: string) {
    visitorDate(date);
    if (!isDshSite(site)) throw new BadRequestException('사이트를 선택하세요.');
    const rows: Array<{
      id: string;
      createdAt: string;
      before: unknown;
      after: unknown;
    }> = await this.ds.query(
      `SELECT a.vad_id AS id,a.created_at::text AS "createdAt",a.vad_before AS before,a.vad_after AS after
       FROM amb_acm_dsh_visit_audit a JOIN amb_acm_dsh_visit_observation o ON o.vob_id=a.vob_id AND o.ent_id=a.ent_id
       WHERE a.ent_id=$1 AND o.vob_date=$2 AND o.vob_site=$3 ORDER BY a.created_at DESC,a.vad_id DESC LIMIT 100`,
      [entId, date, site],
    );
    return { rows };
  }
}
