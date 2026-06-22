/**
 * Configuration loader for the MySQL → PG migration runner.
 *
 * Env vars are read on import; missing required values fail-fast so the
 * operator catches misconfiguration before any DB connection attempt.
 */

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface PgConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface MigrationConfig {
  mysql: MysqlConfig;
  pg: PgConfig;
  batchSize: number;
  auditCutoffDays: number;
  dryRun: boolean;
  conflictReportPath: string;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Env ${name} must be an integer, got: ${raw}`);
  }
  return n;
}

export function loadConfig(): MigrationConfig {
  return {
    mysql: {
      host: process.env.MYSQL_HOST ?? '127.0.0.1',
      port: optionalInt('MYSQL_PORT', 3306),
      user: process.env.MYSQL_USER ?? 'root',
      password: required('MYSQL_ROOT_PASSWORD'),
      database: process.env.MYSQL_DATABASE ?? 'db_tac',
    },
    pg: {
      host: process.env.ACM_PG_HOST ?? '127.0.0.1',
      port: optionalInt('ACM_PG_PORT', 5434),
      user: process.env.ACM_PG_USER ?? 'acm',
      password: required('ACM_PG_PASSWORD'),
      database: process.env.ACM_PG_DATABASE ?? 'db_acm',
    },
    batchSize: optionalInt('MIGRATION_BATCH_SIZE', 500),
    auditCutoffDays: optionalInt('MIGRATION_AUDIT_CUTOFF_DAYS', 90),
    dryRun: (process.env.MIGRATION_DRY_RUN ?? 'false').toLowerCase() === 'true',
    conflictReportPath:
      process.env.MIGRATION_CONFLICT_REPORT ??
      '/tmp/mysql-pg-conflict-report.csv',
  };
}
