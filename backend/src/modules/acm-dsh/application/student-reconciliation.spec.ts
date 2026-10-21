import { calculateOperating, Period } from './operating-calculation';
import { ReconStudent, reconcileStudentCounts } from './student-reconciliation';

const today = '2026-10-21';
const student = (
  id: string,
  status: string,
  site: string | null,
  admissionDate: string | null = '2026-01-01',
): ReconStudent => ({ id, name: id, status, site, admissionDate });
const period = (
  subjectId: string,
  site: string | null,
  start: string | null,
  end: string | null = null,
  extra: Partial<Period> = {},
): Period => ({
  id: `${subjectId}:${start}`,
  kind: 'STUDENT',
  subjectId,
  site,
  start,
  end,
  confirmed: true,
  cancelled: false,
  revision: 1,
  ...extra,
});

describe('reconcileStudentCounts', () => {
  const students = [
    student('ok', 'ACTIVE', 'TPI'),
    student('noSite', 'ACTIVE', null),
    student('noAdmission', 'ACTIVE', 'TPI', null),
    student('future', 'ACTIVE', 'TRINITY', '2026-11-01'),
    student('ended', 'ACTIVE', 'TPI'),
    student('unconfirmed', 'ACTIVE', 'TPI'),
    student('withdrawn', 'WITHDRAWN', 'SANTACROCE'),
    student('paused', 'INACTIVE', 'TPI'),
    student('moved', 'ACTIVE', 'TPI'),
    student('gone', 'WITHDRAWN', 'TPI'),
  ];
  const periods = [
    period('ok', 'TPI', '2026-01-01'),
    period('noSite', null, '2026-01-01'),
    period('noAdmission', 'TPI', '2026-01-01'),
    period('future', 'TRINITY', '2026-11-01'),
    period('ended', 'TPI', '2026-01-01', today),
    period('unconfirmed', 'TPI', '2026-01-01', null, { confirmed: false }),
    period('withdrawn', 'SANTACROCE', '2026-01-01'),
    period('paused', 'TPI', '2026-01-01'),
    period('moved', 'TPI', '2026-01-01'),
    period('moved', 'TRINITY', '2026-06-01'),
    period('gone', 'TPI', '2026-01-01', '2026-09-30'),
  ];
  const r = reconcileStudentCounts(students, periods, today);
  const count = (code: string) => r.reasons.find((x) => x.code === code)!;

  it('classifies each reason once', () => {
    expect(r.active).toBe(7);
    expect(count('ACTIVE_NO_SITE').students.map((s) => s.id)).toEqual(['noSite']);
    expect(count('ACTIVE_NO_ADMISSION').students.map((s) => s.id)).toEqual(['noAdmission']);
    expect(count('ACTIVE_FUTURE_ADMISSION').students.map((s) => s.id)).toEqual(['future']);
    expect(count('ACTIVE_NO_OPEN_PERIOD').students.map((s) => s.id).sort()).toEqual([
      'ended',
      'unconfirmed',
    ]);
    expect(count('INACTIVE_OPEN_PERIOD').students.map((s) => s.id).sort()).toEqual([
      'paused',
      'withdrawn',
    ]);
    expect(count('MULTI_SITE').count).toBe(1);
  });

  it('matches the operating stock and closes the equation', () => {
    const ops = calculateOperating(
      periods,
      [],
      today,
      today,
      'ALL',
      today,
      students.map((s) => ({ subjectId: s.id, site: s.site, date: s.admissionDate })),
    );
    expect(r.operating).toBe(ops.summary.ops_count_st!.calculated);
    const explained = r.reasons.reduce((n, x) => n + x.sign * x.count, 0);
    expect(r.active - r.operating).toBe(explained);
  });

  it('limits listed students', () => {
    const many = Array.from({ length: 55 }, (_, i) => student(`s${i}`, 'ACTIVE', null));
    const row = reconcileStudentCounts(many, [], today).reasons[0];
    expect(row.count).toBe(55);
    expect(row.students).toHaveLength(50);
    expect(row.more).toBe(5);
  });
});
