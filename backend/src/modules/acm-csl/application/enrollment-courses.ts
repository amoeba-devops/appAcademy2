import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { isUUID } from 'class-validator';
export async function validateEnrollmentCourses(
  manager: EntityManager,
  entId: string,
  enrollmentId: string,
  ids: string[],
) {
  if (
    !Array.isArray(ids) ||
    ids.length > 100 ||
    ids.some((id) => !isUUID(id)) ||
    new Set(ids).size !== ids.length
  )
    throw new BadRequestException('INVALID_COURSE_SELECTION');
  const courses = await manager.query<
    Array<{ id: string; active: boolean; selected: boolean }>
  >(
    `SELECT c.crs_id::text id,c.crs_is_active active,EXISTS(SELECT 1 FROM amb_acm_csl_enrollment_course l WHERE l.ent_id=c.ent_id AND l.enr_id=$2 AND l.course_id=c.crs_id) selected FROM amb_acm_csl_course c WHERE c.ent_id=$1 AND c.crs_id=ANY($3::uuid[]) FOR SHARE`,
    [entId, enrollmentId, ids],
  );
  if (
    courses.length !== ids.length ||
    courses.some((c) => !c.active && !c.selected)
  )
    throw new BadRequestException('INVALID_OR_INACTIVE_COURSE');
}
export async function replaceEnrollmentCourses(
  manager: EntityManager,
  entId: string,
  enrollmentId: string,
  ids: string[],
) {
  await validateEnrollmentCourses(manager, entId, enrollmentId, ids);
  await manager.query(
    'DELETE FROM amb_acm_csl_enrollment_course WHERE ent_id=$1 AND enr_id=$2 AND NOT(course_id=ANY($3::uuid[]))',
    [entId, enrollmentId, ids],
  );
  await manager.query(
    `INSERT INTO amb_acm_csl_enrollment_course(ent_id,enr_id,course_id) SELECT $1,$2,id FROM unnest($3::uuid[]) id ON CONFLICT(ent_id,enr_id,course_id) DO NOTHING`,
    [entId, enrollmentId, ids],
  );
}
