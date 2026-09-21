import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';

/** Current master-data snapshot only. Never writes or backfills historical KPI rows. */
export const CURRENT_SOURCE_SQL = `
WITH students AS MATERIALIZED (
 SELECT std_id, std_status, std_admission_date, std_withdrawn_date
 FROM amb_acm_std_student WHERE ent_id=$1 AND deleted_at IS NULL
), teachers AS MATERIALIZED (
 SELECT tch_id, tch_status, tch_hired_at FROM amb_acm_tch_teacher
 WHERE ent_id=$1 AND deleted_at IS NULL AND tch_is_instructor=true
), assignments AS MATERIALIZED (
 SELECT DISTINCT s.std_id,t.tch_id FROM amb_acm_std_student_teacher l
 JOIN students s ON s.std_id=l.std_id AND s.std_status='ACTIVE'
 JOIN teachers t ON t.tch_id=l.tch_id AND t.tch_status='ACTIVE'
 WHERE l.ent_id=$1
)
SELECT statement_timestamp() AS "asOf",
 (SELECT COUNT(*) FROM students WHERE std_status='ACTIVE')::int AS "activeStudents",
 (SELECT COUNT(*) FROM students WHERE std_status='INACTIVE')::int AS "inactiveStudents",
 (SELECT COUNT(*) FROM students WHERE std_status='WITHDRAWN')::int AS "withdrawnStudents",
 (SELECT COUNT(*) FROM teachers WHERE tch_status='ACTIVE')::int AS "activeTeachers",
 (SELECT COUNT(DISTINCT std_id) FROM assignments)::int AS "assignedStudents",
 (SELECT COUNT(DISTINCT tch_id) FROM assignments)::int AS "assignedTeachers",
 (SELECT COUNT(*) FROM students WHERE std_status='ACTIVE' AND std_admission_date IS NULL)::int AS "missingAdmissionDates",
 (SELECT COUNT(*) FROM students WHERE std_status='WITHDRAWN' AND std_withdrawn_date IS NULL)::int AS "missingWithdrawalDates",
 (SELECT COUNT(*) FROM teachers WHERE tch_status='ACTIVE' AND tch_hired_at IS NULL)::int AS "missingHireDates"`;

export interface CurrentSourceSnapshot {
  definitionVersion: 'current-master-v1';
  scope: 'ALL';
  asOf: string;
  activeStudents: number;
  inactiveStudents: number;
  withdrawnStudents: number;
  activeTeachers: number;
  assignedStudents: number;
  assignedTeachers: number;
  missingAdmissionDates: number;
  missingWithdrawalDates: number;
  missingHireDates: number;
}

type SourceRow = Omit<
  CurrentSourceSnapshot,
  'definitionVersion' | 'scope' | 'asOf'
> & { asOf: Date };

@Injectable()
export class SourceCurrentService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async getCurrent(entId: string): Promise<CurrentSourceSnapshot> {
    // One SQL statement guarantees the same MVCC snapshot across all counts.
    const [row] = await this.ds.query<SourceRow[]>(CURRENT_SOURCE_SQL, [entId]);
    return {
      ...row,
      definitionVersion: 'current-master-v1',
      scope: 'ALL',
      asOf: new Date(row.asOf).toISOString(),
    };
  }
}
