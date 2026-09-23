import { calculateOperating, Period } from './operating-calculation';
import { validateOpsDate } from './operating.service';
const period = (
  site: string | null,
  start: string,
  end: string | null = null,
): Period => ({
  id: 'p',
  subjectId: site ?? 'unclassified',
  kind: 'STUDENT',
  site,
  start,
  end,
  confirmed: true,
  cancelled: false,
  revision: 1,
});
describe('operating site sum', () => {
  it('sums exactly three sites and carries earlier balances into every day', () => {
    const ps = [
      period('TPI', '2024-12-02'),
      period('TRINITY', '2025-01-01'),
      period('SANTACROCE', '2025-02-01', '2026-09-02'),
      period(null, '2024-12-02'),
    ];
    const all = calculateOperating(
      ps,
      [],
      '2026-09-01',
      '2026-09-03',
      'ALL',
      '2026-09-03',
      ps.map((p) => ({ subjectId: p.subjectId!, site: p.site, date: p.start })),
    );
    expect(all.openingBalance.students).toBe(3);
    expect(all.quality.unclassified).toBe(1);
    for (let i = 0; i < 3; i++)
      for (const k of ['ops_new_st', 'ops_out_st', 'ops_count_st'] as const)
        expect(all.rows[i].values[k]!.calculated).toBe(
          ['TPI', 'TRINITY', 'SANTACROCE'].reduce(
            (n, s) =>
              n +
              calculateOperating(
                ps,
                [],
                '2026-09-01',
                '2026-09-03',
                s,
                '2026-09-03',
                ps.map((p) => ({
                  subjectId: p.subjectId!,
                  site: p.site,
                  date: p.start,
                })),
              ).rows[i].values[k]!.calculated!,
            0,
          ),
        );
    expect(all.summary.ops_count_st?.calculated).toBe(2);
  });
  it('preserves re-entry events and explicit manual zero without copying ALL manual to sites', () => {
    const ps = [
      period('TPI', '2026-01-01', '2026-01-02'),
      period('TPI', '2026-01-03'),
    ];
    const manual = [
      {
        date: '2026-01-01',
        site: 'ALL',
        metric: 'ops_new_st' as const,
        value: 0,
      },
    ];
    const r = calculateOperating(
      ps,
      manual,
      '2026-01-01',
      '2026-01-04',
      'ALL',
      '2026-01-03',
      [{ subjectId: 'TPI', site: 'TPI', date: '2026-01-01' }],
    );
    expect(r.summary.ops_new_st?.calculated).toBe(1);
    expect(r.summary.ops_out_st?.calculated).toBe(1);
    expect(r.summary.ops_count_st?.calculated).toBe(1);
    expect(r.rows[0].values.ops_new_st).toMatchObject({
      manual: 0,
      manualPresent: true,
    });
    expect(r.rows[1].values.ops_new_st?.manualPresent).toBe(false);
    expect(r.rows[3].values.ops_new_st?.calculated).toBeNull();
    expect(
      calculateOperating(
        ps,
        manual,
        '2026-01-01',
        '2026-01-03',
        'TPI',
        '2026-01-03',
      ).rows[0].values.ops_new_st?.manualPresent,
    ).toBe(false);
  });
  it('never fabricates teacher dates and skips cancelled periods', () => {
    const p = period('TPI', '2026-01-01');
    p.cancelled = true;
    const t = {
      ...period(null, '2026-01-01'),
      kind: 'TEACHER' as const,
      start: null,
    };
    const r = calculateOperating(
      [p, t],
      [],
      '2026-01-01',
      '2026-01-01',
      'ALL',
      '2026-01-01',
    );
    expect(r.summary.ops_count_st?.calculated).toBe(0);
    expect(r.summary.ops_count_tc?.calculated).toBeNull();
  });
  it('rejects non-calendar dates', () => {
    expect(() => validateOpsDate('2026-02-30')).toThrow();
    expect(() => validateOpsDate('2026-01-01')).not.toThrow();
  });
});

describe('admission-based new students', () => {
  it('counts each student once on admission date, independently of class periods and status', () => {
    const periods = [
      period('TPI', '2026-09-02', '2026-09-03'),
      period('TPI', '2026-09-05'),
    ];
    const admissions = [
      { subjectId: 'TPI', site: 'TPI', date: '2026-09-01' },
      { subjectId: 't', site: 'TRINITY', date: '2026-09-01' },
      { subjectId: 'u', site: 'SANTACROCE', date: null },
      { subjectId: 'x', site: null, date: '2026-09-01' },
    ];
    const all = calculateOperating(
      periods,
      [],
      '2026-09-01',
      '2026-09-05',
      'ALL',
      '2026-09-05',
      admissions,
    );
    expect(all.rows[0].values.ops_new_st?.calculated).toBe(2);
    expect(all.rows[1].values.ops_new_st?.calculated).toBe(0);
    expect(all.summary.ops_new_st?.calculated).toBe(2);
    expect(all.quality.missingAdmissions).toBe(1);
    expect(all.summary.ops_new_st?.calculated).toBe(
      ['TPI', 'TRINITY', 'SANTACROCE'].reduce(
        (n, site) =>
          n +
          (calculateOperating(
            periods,
            [],
            '2026-09-01',
            '2026-09-05',
            site,
            '2026-09-05',
            admissions,
          ).summary.ops_new_st?.calculated ?? 0),
        0,
      ),
    );
  });
});

describe('admission-based student stock', () => {
  it('counts admission on the 22nd even when classes start on the 23rd; preserves manual zero and teacher dates', () => {
    const ps = [
      period('TPI', '2026-09-23'),
      { ...period(null, '2026-09-23'), kind: 'TEACHER' as const },
    ];
    const admissions = [{ subjectId: 'TPI', site: 'TPI', date: '2026-09-22' }];
    const r = calculateOperating(
      ps,
      [{ date: '2026-09-22', site: 'ALL', metric: 'ops_count_st', value: 0 }],
      '2026-09-21',
      '2026-09-24',
      'ALL',
      '2026-09-23',
      admissions,
    );
    expect(r.rows.map((x) => x.values.ops_count_st?.calculated)).toEqual([
      0,
      1,
      1,
      null,
    ]);
    expect(r.rows.map((x) => x.values.ops_count_tc?.calculated)).toEqual([
      0,
      0,
      1,
      null,
    ]);
    expect(r.rows[1].values.ops_count_st).toMatchObject({
      manual: 0,
      manualPresent: true,
    });
    expect(r.rows[2].values.ops_count_st?.manualPresent).toBe(false);
    expect(
      calculateOperating(
        ps,
        [],
        '2026-09-23',
        '2026-09-23',
        'TPI',
        '2026-09-23',
        admissions,
      ).openingBalance.students,
    ).toBe(1);
  });
  it('uses admission without a class start and excludes missing admissions without falling back to class dates', () => {
    const ps = [
      { ...period('TPI', '2026-01-01'), start: null },
      period('TRINITY', '2026-01-01'),
    ];
    const r = calculateOperating(
      ps,
      [],
      '2026-01-01',
      '2026-01-01',
      'ALL',
      '2026-01-01',
      [
        { subjectId: 'TPI', site: 'TPI', date: '2026-01-01' },
        { subjectId: 'TRINITY', site: 'TRINITY', date: null },
        { subjectId: 'new', site: 'SANTACROCE', date: '2026-01-01' },
        { subjectId: 'unknown', site: null, date: '2026-01-01' },
      ],
    );
    expect(r.summary.ops_count_st).toMatchObject({
      calculated: 2,
      quality: 'PARTIAL',
    });
  });
  it('deduplicates overlapping periods, excludes withdrawal day and preserves re-entry gaps and site sums', () => {
    const ps = [
      period('TPI', '2026-01-02', '2026-01-04'),
      period('TPI', '2026-01-03', '2026-01-04'),
      { ...period('TRINITY', '2026-01-06'), subjectId: 'TPI' },
    ];
    const admissions = [{ subjectId: 'TPI', site: 'TPI', date: '2026-01-01' }];
    const r = calculateOperating(
      ps,
      [],
      '2026-01-01',
      '2026-01-06',
      'ALL',
      '2026-01-06',
      admissions,
    );
    expect(r.rows.map((x) => x.values.ops_count_st?.calculated)).toEqual([
      1, 1, 1, 0, 0, 1,
    ]);
    const perSite = ['TPI', 'TRINITY', 'SANTACROCE'].map((site) =>
      calculateOperating(ps, [], r.from, r.to, site, r.to, admissions),
    );
    r.rows.forEach((row, i) =>
      expect(row.values.ops_count_st?.calculated).toBe(
        perSite.reduce(
          (n, s) => n + s.rows[i].values.ops_count_st!.calculated!,
          0,
        ),
      ),
    );
  });
  it('does not resurrect cancelled or unconfirmed records using admission', () => {
    const ps = [
      { ...period('TPI', '2026-01-01'), cancelled: true },
      { ...period('TRINITY', '2026-01-01'), confirmed: false },
    ];
    const admissions = ps.map((p) => ({
      subjectId: p.subjectId!,
      site: p.site,
      date: p.start,
    }));
    expect(
      calculateOperating(
        ps,
        [],
        '2026-01-01',
        '2026-01-01',
        'ALL',
        '2026-01-01',
        admissions,
      ).summary.ops_count_st?.calculated,
    ).toBe(0);
  });
});
