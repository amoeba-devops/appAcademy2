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
    const past = events.filter((e) => e.date <= date);
    const latest = new Map<string, LifeEvent>();
    for (const e of [...past].sort(
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
    const schedules = new Map<string, LifeEvent[]>();
    for (const e of latest.values())
      if (['SCHEDULING', 'SCHEDULED'].includes(e.payload.status ?? ''))
        schedules.set(e.person, [...(schedules.get(e.person) ?? []), e]);
    for (const [person, es] of schedules) {
      const pending = es.filter((e) => e.payload.status === 'SCHEDULING');
      if (
        pending.length
          ? pending.some((e) => inSite(e.site))
          : es.some((e) => inSite(e.site))
      )
        sets[pending.length ? 'cs_scheduling' : 'cs_scheduled'].add(person);
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
        ...(['cs_new_class', 'ops_returning_st', 'ops_referral_st'].includes(
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
