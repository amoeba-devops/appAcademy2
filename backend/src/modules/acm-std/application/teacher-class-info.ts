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
    teacherClassInfos: rows.map((r) => ({ tchId: r.tchId, ...r.info })),
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
        `UPDATE amb_acm_std_teacher_class_info SET info=$4::jsonb, updated_at=now(),
       legacy_source=CASE WHEN tch_id=$5::uuid THEN $6::jsonb ELSE legacy_source END
       WHERE ent_id=$1 AND std_id=$2 AND tch_id=$3`,
        [
          student.entId,
          student.id,
          info.tchId,
          JSON.stringify(classValues(info)),
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
