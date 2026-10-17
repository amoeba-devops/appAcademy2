/**
 * REQ-261017B — 저장소에 공개된 시드 비밀번호의 bcrypt 해시
 * (sql/acm/500-acm-auth.sql, sql/acm/511-seed-app-admin-dev.sql).
 * 이 해시를 그대로 가진 계정은 누구나 아는 비밀번호로 로그인할 수 있다.
 */
export const PUBLIC_SEED_PASSWORD_HASHES: readonly string[] = [
  '$2b$12$6szKyUcXX6Zgt9/o3M/k9OUz01iCbqr6Y7VMMj6SKPGiDBrTfZ0Ka',
  '$2b$12$7YJIg0yE8S04xPIrcLMZ8ujuSJNXctXuoOnjw83bKrUZcJPTVjbVa',
];

export const isPublicSeedHash = (hash: string | null | undefined): boolean =>
  !!hash && PUBLIC_SEED_PASSWORD_HASHES.includes(hash);
