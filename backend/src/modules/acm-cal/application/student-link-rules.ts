/** REQ-261023B — which students a class-event title names (pure). */
export interface StudentCandidate {
  stdId: string;
  name: string;
  status: string;
  /** Name of the longer matched student that contains this one (dropped from the default). */
  suppressedBy?: string;
}
export type LinkState = 'SURE' | 'MULTI' | 'NONE';

/**
 * Names contained in the title (2+ chars). Longest name wins: a candidate whose name is part
 * of another matched candidate's name ("김민" in "김민재") is kept but marked `suppressedBy`.
 */
export function matchStudents(
  title: string,
  students: { stdId: string; name: string; status: string }[],
): { candidates: StudentCandidate[]; state: LinkState } {
  const hits = students.filter(
    (s) => s.name.trim().length >= 2 && title.includes(s.name.trim()),
  );
  const candidates: StudentCandidate[] = hits.map((s) => {
    const longer = hits.find(
      (o) =>
        o.stdId !== s.stdId &&
        o.name.length > s.name.length &&
        o.name.includes(s.name),
    );
    return {
      stdId: s.stdId,
      name: s.name,
      status: s.status,
      ...(longer ? { suppressedBy: longer.name } : {}),
    };
  });
  candidates.sort(
    (a, b) =>
      title.indexOf(a.name) - title.indexOf(b.name) ||
      a.name.localeCompare(b.name, 'ko'),
  );
  const kept = candidates.filter((c) => !c.suppressedBy);
  const distinctNames = new Set(kept.map((c) => c.name));
  // Same name for two students cannot be told apart from the title → needs a human.
  const ambiguousName = distinctNames.size < kept.length;
  const state: LinkState =
    kept.length === 0
      ? 'NONE'
      : kept.length === 1 && !ambiguousName
        ? 'SURE'
        : 'MULTI';
  return { candidates, state };
}
