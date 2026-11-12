import { calculateOperating } from './operating-calculation';
import { ReconStudent, reconcileStudentCounts } from './student-reconciliation';

const today = '2026-11-12';
const student = (
  id: string,
  status: string,
  site: string | null,
  admissionDate: string | null = '2026-01-01',
): ReconStudent => ({ id, name: id, status, site, admissionDate });

describe('reconcileStudentCounts (REQ-261112B)', () => {
  const students = [
    student('ok', 'ACTIVE', 'TPI'),
    student('noAdmission', 'ACTIVE', 'SANTACROCE', null),
    student('future', 'ACTIVE', 'TRINITY', '2026-12-01'),
    student('noSite', 'ACTIVE', null),
    student('otherSite', 'ACTIVE', 'ONLINE'),
    student('paused', 'INACTIVE', 'TPI'),
    student('gone', 'WITHDRAWN', 'TPI'),
  ];
  const r = reconcileStudentCounts(students);

  it('explains the difference only by active students without a site', () => {
    expect(r.active).toBe(5);
    expect(r.operating).toBe(3);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0]).toMatchObject({ code: 'ACTIVE_NO_SITE', sign: 1, count: 2 });
    expect(r.reasons[0].students.map((s) => s.id).sort()).toEqual(['noSite', 'otherSite']);
  });

  it('matches the operating stock for today and closes the equation', () => {
    const ops = calculateOperating(
      [],
      [],
      today,
      today,
      'ALL',
      today,
      students.map((s) => ({
        subjectId: s.id,
        site: s.site,
        date: s.admissionDate,
        status: s.status,
      })),
    );
    expect(ops.summary.ops_count_st?.calculated).toBe(r.operating);
    expect(r.active - r.operating).toBe(r.reasons[0].count);
  });
});
