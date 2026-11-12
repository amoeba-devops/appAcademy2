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
    // 오늘(09-03) 현재 상태: 종료된 SANTACROCE 는 퇴원.
    const adm = ps.map((p) => ({
      subjectId: p.subjectId!,
      site: p.site,
      date: p.start,
      status: p.end ? 'WITHDRAWN' : 'ACTIVE',
      withdrawn: p.end,
    }));
    const all = calculateOperating(
      ps,
      [],
      '2026-09-01',
      '2026-09-03',
      'ALL',
      '2026-09-03',
      adm,
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
                adm,
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
      [{ subjectId: 'TPI', site: 'TPI', date: '2026-01-01', status: 'ACTIVE' }],
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

describe('active-based student stock (REQ-261112B)', () => {
  const adm = (
    subjectId: string,
    site: string | null,
    status: string,
    date: string | null = '2026-01-01',
    withdrawn: string | null = null,
  ) => ({ subjectId, site, status, date, withdrawn });

  it('counts only site-assigned students whose current status is ACTIVE today, regardless of class periods', () => {
    const r = calculateOperating(
      [period('TPI', '2026-01-01', '2026-03-01')],
      [],
      '2026-11-12',
      '2026-11-12',
      'ALL',
      '2026-11-12',
      [
        adm('TPI', 'TPI', 'ACTIVE'),
        adm('a', 'SANTACROCE', 'ACTIVE', null),
        adm('b', 'TRINITY', 'ACTIVE', '2026-12-01'),
        adm('noSite', null, 'ACTIVE'),
        adm('paused', 'TPI', 'INACTIVE'),
        adm('gone', 'TPI', 'WITHDRAWN', '2026-01-01', '2026-06-01'),
      ],
    );
    expect(r.summary.ops_count_st).toMatchObject({ calculated: 3, quality: 'COMPLETE' });
  });

  it('uses status history for past days and admission/withdrawal dates before any history', () => {
    const admissions = [
      adm('s1', 'TPI', 'INACTIVE', '2026-01-01'),
      adm('s2', 'TPI', 'WITHDRAWN', '2026-01-01', '2026-10-03'),
      adm('s3', 'TRINITY', 'ACTIVE', '2026-10-02'),
    ];
    const history = [
      { subjectId: 's1', status: 'ACTIVE', date: '2026-01-01' },
      { subjectId: 's1', status: 'INACTIVE', date: '2026-10-03' },
      { subjectId: 's2', status: 'WITHDRAWN', date: '2026-10-03' },
      { subjectId: 's3', status: 'ACTIVE', date: '2026-10-02' },
    ];
    const r = calculateOperating(
      [],
      [{ date: '2026-10-02', site: 'ALL', metric: 'ops_count_st', value: 0 }],
      '2026-10-01',
      '2026-10-05',
      'ALL',
      '2026-10-04',
      admissions,
      history,
    );
    // 10-01: s1(이력)·s2(입학일) / 10-02: +s3 / 10-03: s1 휴원·s2 퇴원 / 10-04(오늘): 현재 상태 / 10-05: 미래
    expect(r.rows.map((x) => x.values.ops_count_st?.calculated)).toEqual([2, 3, 1, 1, null]);
    expect(r.rows[1].values.ops_count_st).toMatchObject({ manual: 0, manualPresent: true });
    expect(r.openingBalance.students).toBe(2);
    const perSite = ['TPI', 'TRINITY', 'SANTACROCE'].map((site) =>
      calculateOperating([], [], r.from, r.to, site, '2026-10-04', admissions, history),
    );
    r.rows.forEach((row, i) =>
      expect(row.values.ops_count_st?.calculated).toBe(
        row.values.ops_count_st?.calculated === null
          ? null
          : perSite.reduce((n, s) => n + s.rows[i].values.ops_count_st!.calculated!, 0),
      ),
    );
  });

  it('applies same-day history in recorded order and marks past days partial when admissions are missing', () => {
    const r = calculateOperating(
      [],
      [],
      '2026-10-10',
      '2026-10-11',
      'TPI',
      '2026-10-11',
      [adm('x', 'TPI', 'ACTIVE'), adm('y', 'TPI', 'ACTIVE', null)],
      [
        { subjectId: 'x', status: 'INACTIVE', date: '2026-10-10' },
        { subjectId: 'x', status: 'ACTIVE', date: '2026-10-10' },
      ],
    );
    expect(r.rows[0].values.ops_count_st).toMatchObject({ calculated: 1, quality: 'PARTIAL' });
    expect(r.rows[1].values.ops_count_st).toMatchObject({ calculated: 2, quality: 'COMPLETE' });
  });
});
