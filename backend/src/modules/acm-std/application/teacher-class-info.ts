import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { StudentTypeormEntity } from '../infrastructure/typeorm/student.typeorm-entity';
import { TeacherClassInfoDto } from './dto/student.dto';

export const CLASS_FIELDS = [
  'subject',
  'curriculum',
  'materials',
  'mobility',
  'gpa',
  'ssatIseeNote',
] as const;
type ClassValues = Record<(typeof CLASS_FIELDS)[number], string | null>;
/** REQ-261103B — 강사별 수업정보 항목. 학생 행(레거시)에 없는 수업링크 포함. */
export const INFO_FIELDS = [...CLASS_FIELDS, 'meetingUrl'] as const;
type InfoField = (typeof INFO_FIELDS)[number];
/** REQ-261103C — 강사별 수업링크(여러 개). `meetingUrl` 은 첫 링크 미러(예전 화면 호환). */
export interface ClassLink {
  label: string | null;
  url: string;
}
export const MAX_CLASS_LINKS = 10;
/**
 * 인터넷 주소는 형식 검사 없이 허용. `zoom.us/j/1` 처럼 앞부분이 없으면 https:// 를 붙이고,
 * http(s) 가 아닌 주소(javascript:·data: 등)는 화면에서 실행될 수 있어 거부한다.
 */
export function normalizeLink(raw: string): string {
  const v = raw.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(v))
    throw new BadRequestException('CLASS_LINK_INVALID');
  return `https://${v.replace(/^\/+/, '')}`;
}
export function normalizeLinks(
  links: Array<{ label?: string | null; url?: string | null }>,
): ClassLink[] {
  return links
    .filter((l) => l.url?.trim())
    .map((l) => ({ label: l.label?.trim() || null, url: normalizeLink(l.url!) }));
}
/** 저장된 info 의 링크 목록 — 예전 `meetingUrl` 하나만 있는 행도 1건으로 읽는다. */
export function readLinks(info: Record<string, unknown> | null): ClassLink[] {
  if (Array.isArray(info?.links)) return info.links as ClassLink[];
  return typeof info?.meetingUrl === 'string' && info.meetingUrl
    ? [{ label: null, url: info.meetingUrl }]
    : [];
}
/** 보낸 항목만 고친다 — 화면에서 숨긴 항목(이동수단·GPA 등)은 기존 값 유지. */
export function infoPatch(
  value: Partial<Record<InfoField, string | null>> & {
    links?: Array<{ label?: string | null; url?: string | null }>;
  },
): Record<string, unknown> {
  const patch: Record<string, unknown> = Object.fromEntries(
    INFO_FIELDS.filter((k) => value[k] !== undefined).map((k) => [
      k,
      value[k]?.trim() || null,
    ]),
  );
  if (value.links !== undefined) {
    const links = normalizeLinks(value.links);
    patch.links = links;
    patch.meetingUrl = links[0]?.url ?? null;
  } else if (patch.meetingUrl !== undefined) {
    const url = patch.meetingUrl ? normalizeLink(patch.meetingUrl as string) : null;
    patch.meetingUrl = url;
    patch.links = url ? [{ label: null, url }] : [];
  }
  return patch;
}
export function classValues(value: Partial<ClassValues>): ClassValues {
  return Object.fromEntries(
    CLASS_FIELDS.map((k) => [k, value[k]?.trim() || null]),
  ) as ClassValues;
}
export async function readClassInfos(
  manager: EntityManager,
  student: StudentTypeormEntity,
) {
  const legacy = classValues(student);
  const rows: Array<{ tchId: string; info: ClassValues; assigned: boolean }> =
    await manager.query(
      `SELECT tch_id AS "tchId", info, legacy_source = $3::jsonb AS assigned
     FROM amb_acm_std_teacher_class_info WHERE ent_id=$1 AND std_id=$2`,
      [student.entId, student.id, JSON.stringify(legacy)],
    );
  return {
    teacherClassInfos: rows.map((r) => ({
      tchId: r.tchId,
      ...r.info,
      links: readLinks(r.info),
    })),
    classInfoLegacyPending:
      Object.values(legacy).some(Boolean) && !rows.some((r) => r.assigned),
  };
}
export async function saveClassInfos(
  manager: EntityManager,
  student: StudentTypeormEntity,
  teacherIds: string[],
  infos: TeacherClassInfoDto[] | undefined,
  legacyTeacherId?: string,
  legacyPatch?: Partial<ClassValues>,
) {
  if (
    infos !== undefined &&
    (infos.length !== teacherIds.length ||
      new Set(infos.map((x) => x.tchId)).size !== infos.length ||
      infos.some((x) => !teacherIds.includes(x.tchId)))
  )
    throw new BadRequestException('CLASS_INFO_TEACHERS_MISMATCH');
  if (legacyTeacherId && (!infos || !teacherIds.includes(legacyTeacherId)))
    throw new BadRequestException('CLASS_INFO_LEGACY_TEACHER_INVALID');
  const legacy = classValues(student);
  for (const tchId of teacherIds) {
    // A newly assigned teacher starts empty. Never attribute a previously shared value by guessing.
    await manager.query(
      `INSERT INTO amb_acm_std_teacher_class_info(ent_id,std_id,tch_id,info)
      VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(ent_id,std_id,tch_id) DO NOTHING`,
      [student.entId, student.id, tchId, JSON.stringify(classValues({}))],
    );
  }
  if (infos !== undefined) {
    for (const info of infos)
      await manager.query(
        `UPDATE amb_acm_std_teacher_class_info SET info=info || $4::jsonb, updated_at=now(),
       legacy_source=CASE WHEN tch_id=$5::uuid THEN $6::jsonb ELSE legacy_source END
       WHERE ent_id=$1 AND std_id=$2 AND tch_id=$3`,
        [
          student.entId,
          student.id,
          info.tchId,
          JSON.stringify(infoPatch(info)),
          legacyTeacherId ?? null,
          JSON.stringify(legacy),
        ],
      );
  } else if (
    teacherIds.length === 1 &&
    legacyPatch &&
    Object.keys(legacyPatch).length
  ) {
    // Old clients update only fields they actually supplied; independent profile values survive.
    const patch = Object.fromEntries(
      Object.entries(legacyPatch).map(([k, v]) => [k, v?.trim() || null]),
    );
    await manager.query(
      `UPDATE amb_acm_std_teacher_class_info SET info=info || $4::jsonb,
      legacy_source=$5::jsonb, updated_at=now() WHERE ent_id=$1 AND std_id=$2 AND tch_id=$3`,
      [
        student.entId,
        student.id,
        teacherIds[0],
        JSON.stringify(patch),
        JSON.stringify(legacy),
      ],
    );
  }
}
