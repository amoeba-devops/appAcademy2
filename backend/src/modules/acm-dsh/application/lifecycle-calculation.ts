export const LIFE_CODES = [
  'cs_scheduling',
  'cs_scheduled',
  'cs_new_class',
  'ops_new_st',
  'ops_returning_st',
  'ops_referral_st',
] as const;
export type LifeCode = (typeof LIFE_CODES)[number];
export interface LifeEvent {
  id: string;
  person: string;
  subjectKind: string;
  subjectId: string;
  kind: string;
  date: string;
  site: string;
  createdAt: string;
  payload: {
    status?: string;
    courseKey?: string;
    verified?: boolean;
    relatedId?: string;
    relatedKind?: string;
    stoppedDate?: string;
  };
}
export interface LifeStudent {
  id: string;
  site: string | null;
  start: string | null;
}
export interface LifeCell {
  calculated: number | null;
  manual: null;
  manualPresent: false;
  quality: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
}
export function lifecycleRange(
  events: LifeEvent[],
  students: LifeStudent[],
  from: string,
  to: string,
  today: string,
  site = 'ALL',
) {
  const rows: Array<{ date: string; values: Record<LifeCode, LifeCell> }> = [];
  const members: Record<string, Record<LifeCode, string[]>> = {};
  const inSite = (s: string | null) => site === 'ALL' || s === site;
  for (
    let date = from;
    date <= to;
    date = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)
  ) {
    const sets = Object.fromEntries(
      LIFE_CODES.map((k) => [k, new Set<string>()]),
    ) as Record<LifeCode, Set<string>>;
    // FIX-261026 — 스케줄 조율/완료는 기록한 날짜 하루만 센다(그날 조율 중·확정했다는 기록).
    // 같은 날 같은 과목에 여러 번 기록하면 마지막 상태, 조율·완료가 같은 날 있으면 둘 다 센다.
    const past = events.filter((e) => e.date <= date);
    const sameDay = past.filter((e) => e.date === date);
    const latest = new Map<string, LifeEvent>();
    for (const e of [...sameDay].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    )) {
      if (e.kind === 'SCHEDULE')
        latest.set(
          `${e.person}:${e.payload.courseKey || `${e.subjectKind}:${e.subjectId}`}`,
          e,
        );
    }
    for (const e of latest.values()) {
      if (!inSite(e.site)) continue;
      if (e.payload.status === 'SCHEDULING') sets.cs_scheduling.add(e.person);
      else if (e.payload.status === 'SCHEDULED') sets.cs_scheduled.add(e.person);
    }
    for (const s of students)
      if (s.start === date && inSite(s.site)) sets.cs_new_class.add(s.id);
    for (const e of past) {
      if (!inSite(e.site) || !e.payload.verified) continue;
      if (e.kind === 'RETURN' && e.date === date)
        sets.ops_returning_st.add(e.person);
      if (e.kind === 'REFERRAL' && e.date === date)
        sets.ops_referral_st.add(e.person);
      if (
        e.kind === 'FIRST_PAYMENT' &&
        !past.some(
          (c) =>
            c.person === e.person &&
            ['FIRST_CLASS', 'PAYMENT_ENDED'].includes(c.kind) &&
            c.payload.verified,
        )
      )
        sets.ops_new_st.add(e.person);
    }
    const values = Object.fromEntries(
      LIFE_CODES.map((k) => [
        k,
        {
          calculated: date > today ? null : sets[k].size,
          manual: null,
          manualPresent: false,
          quality:
            date > today
              ? 'UNAVAILABLE'
              : k === 'cs_new_class' &&
                  !students.some((s) => inSite(s.site) && !s.start)
                ? 'COMPLETE'
                : 'PARTIAL',
        },
      ]),
    ) as Record<LifeCode, LifeCell>;
    members[date] = Object.fromEntries(
      LIFE_CODES.map((k) => [k, [...sets[k]]]),
    ) as Record<LifeCode, string[]>;
    rows.push({ date, values });
  }
  const last = rows.filter((r) => r.date <= today).at(-1);
  const summary = Object.fromEntries(
    LIFE_CODES.map((k) => [
      k,
      {
        ...(last?.values[k] ?? {
          calculated: null,
          manual: null,
          manualPresent: false,
          quality: 'UNAVAILABLE',
        }),
        ...(['cs_new_class', 'ops_returning_st', 'ops_referral_st', 'cs_scheduling', 'cs_scheduled'].includes(
          k,
        ) && last
          ? {
              calculated: new Set(
                rows
                  .filter((r) => r.date <= today)
                  .flatMap((r) => members[r.date][k]),
              ).size,
            }
          : {}),
      },
    ]),
  ) as Record<LifeCode, LifeCell>;
  return {
    definitionVersion: 'student-lifecycle-v1',
    rows,
    summary,
    members,
    asOf: new Date().toISOString(),
    qualityNote:
      'Only verified evidence is counted; historical coverage may be incomplete.',
  };
}
