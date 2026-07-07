import type { ClsSubjectType } from '../types';

// Maps a CSL course-code prefix to the CLS subject category. Kept aligned with
// the TPI course catalog seed (sql/acm/998-seed-tpi-course-catalog.sql).
// Order matters: more specific prefixes (e.g. `SSAT-`) must precede overlapping
// ones (`SAT-`). First match wins.
const COURSE_CODE_SUBJECT_RULES: ReadonlyArray<readonly [readonly string[], ClsSubjectType]> = [
  [['MAP-'], 'MAP_TEST'],
  [['ISEE-'], 'ISEE'],
  [['SSAT-'], 'SSAT'],
  [['DUOLINGO-', 'TOEFL-', 'IELTS-'], 'ENGLISH_TEST'],
  [['PSAT', 'SAT-'], 'SAT'],
  [['PREACT', 'ACT-'], 'ACT'],
  [['INTL-'], 'INTL_PREP'],
];

/**
 * Best-effort mapping from a course catalog code to its class subject type.
 * Returns `null` when no rule matches (e.g. COMPETITION / freetext courses),
 * so callers can fall back to `OTHER` or leave the current selection intact.
 */
export function deriveSubjectTypeFromCourseCode(code?: string): ClsSubjectType | null {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return null;
  for (const [prefixes, subjectType] of COURSE_CODE_SUBJECT_RULES) {
    if (prefixes.some((prefix) => normalized.startsWith(prefix))) return subjectType;
  }
  return null;
}
