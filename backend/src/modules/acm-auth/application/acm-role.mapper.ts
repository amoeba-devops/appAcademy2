export type AcmRole = 'ADMIN' | 'TEACHER' | 'STAFF' | 'APP_ADMIN';

/**
 * AMA USER_LEVELs that map to ACM ADMIN (REQ-260609 FR-B1).
 *
 * The user-facing spec names MASTER & MANAGER. We also treat OWNER as
 * admin-tier — the AMA platform directory uses OWNER as the highest level
 * (see AMA_USER_LEVELS), and demoting an owner to STAFF would be wrong.
 */
const ADMIN_LEVELS = new Set(['MASTER', 'OWNER', 'MANAGER']);

/** AMA job-field value that maps to ACM TEACHER (강사). Everything else → STAFF. */
const TEACHER_JOB_ROLE = 'TEACHER';

/**
 * Map an AMA USER_LEVEL + job field to an ACM role (REQ-260609 FR-B).
 *
 *   MASTER / OWNER / MANAGER            → ADMIN
 *   else, jobRole === 'TEACHER'         → TEACHER (강사)
 *   else (other job / unknown / null)   → STAFF   (직원)
 *
 * @param level   AMA USER_LEVEL (token `role` claim or directory `level`).
 * @param jobRole AMA job/position field; may be null when AMA omits it.
 */
export function mapAcmRole(
  level: string | null | undefined,
  jobRole: string | null | undefined,
): AcmRole {
  const lvl = (level ?? '').trim().toUpperCase();
  if (ADMIN_LEVELS.has(lvl)) return 'ADMIN';
  const job = (jobRole ?? '').trim().toUpperCase();
  if (job === TEACHER_JOB_ROLE) return 'TEACHER';
  return 'STAFF';
}
