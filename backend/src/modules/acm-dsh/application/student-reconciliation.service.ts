import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { kstDaysAgo } from '../business-date';
import { Period } from './operating-calculation';
import { OPERATING_PERIOD_SQL, OperatingService } from './operating.service';
import { ReconStudent, reconcileStudentCounts } from './student-reconciliation';

/** REQ-261021 — read-only breakdown of active students vs operating student count (today, ALL). */
@Injectable()
export class StudentReconciliationService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly operating: OperatingService,
  ) {}

  async get(entId: string) {
    const today = kstDaysAgo(0);
    const [[raw], ops] = await Promise.all([
      this.ds.query<{ students: ReconStudent[]; periods: Period[] }[]>(
        OPERATING_PERIOD_SQL +
          `SELECT COALESCE((SELECT json_agg(s) FROM (SELECT std_id::text id,std_name AS name,std_status AS status,std_site AS site,std_admission_date::text AS "admissionDate" FROM amb_acm_std_student WHERE ent_id=$1 AND deleted_at IS NULL) s),'[]') students, COALESCE((SELECT json_agg(p) FROM periods p WHERE p.kind='STUDENT'),'[]') periods`,
        [entId],
      ),
      this.operating.range(entId, today, today, 'ALL'),
    ]);
    const result = reconcileStudentCounts(raw.students, raw.periods, today);
    const cell = ops.summary.ops_count_st;
    const calculated = cell?.calculated ?? result.operating;
    const explained = result.reasons.reduce((n, r) => n + r.sign * r.count, 0);
    return {
      today,
      definitionVersion: 'student-recon-v1',
      active: result.active,
      operating: {
        calculated,
        manual: cell?.manualPresent ? cell.manual : null,
      },
      difference: result.active - calculated,
      reasons: result.reasons,
      // Non-zero only if this breakdown drifts from the operating calculation.
      other: result.active - calculated - explained,
      asOf: new Date().toISOString(),
    };
  }
}
