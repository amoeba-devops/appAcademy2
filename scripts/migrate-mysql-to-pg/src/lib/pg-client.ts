import { Pool, PoolClient } from 'pg';
import type { PgConfig } from '../config';
import { Logger } from './logger';

/**
 * Thin wrapper around node-postgres Pool.
 *
 * Migration runner uses INSERT ... ON CONFLICT (legacy_id) DO NOTHING for
 * idempotency. Batched inserts via $1, $2... parameterized arrays.
 */
export class PgClient {
  private pool: Pool | null = null;
  private readonly log = new Logger('pg');

  constructor(private readonly cfg: PgConfig) {}

  async connect(): Promise<void> {
    this.pool = new Pool({
      host: this.cfg.host,
      port: this.cfg.port,
      user: this.cfg.user,
      password: this.cfg.password,
      database: this.cfg.database,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
    const { rows } = await this.pool.query<{ ok: number }>('SELECT 1 AS ok');
    if (rows[0]?.ok !== 1) throw new Error('PG ping failed');
    this.log.info('connected', { host: this.cfg.host, db: this.cfg.database });
  }

  async close(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  private requirePool(): Pool {
    if (!this.pool) throw new Error('PG not connected — call connect() first');
    return this.pool;
  }

  async count(table: string, where?: string): Promise<number> {
    const sql = `SELECT COUNT(*)::bigint AS c FROM ${table}${where ? ` WHERE ${where}` : ''}`;
    const { rows } = await this.requirePool().query<{ c: string }>(sql);
    return Number(rows[0]?.c ?? 0);
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const { rows } = await this.requirePool().query<T>(sql, params);
    return rows;
  }

  async findOne<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  /**
   * Run a callback in a transaction. The pool client is reserved + released
   * automatically; BEGIN/COMMIT/ROLLBACK handled here.
   */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.requirePool().connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Batch INSERT with ON CONFLICT DO NOTHING. Returns the number of rows
   * actually inserted (PG `RETURNING` count).
   *
   * @param table     Target PG table name
   * @param columns   Ordered column list (must match `rows` keys)
   * @param rows      Array of row objects
   * @param conflictTarget  Column for ON CONFLICT (typically 'legacy_id')
   * @param dryRun    If true, prints SQL + first 3 rows then returns 0
   */
  async batchInsert(
    client: PoolClient,
    table: string,
    columns: string[],
    rows: Array<Record<string, unknown>>,
    conflictTarget: string,
    opts: { dryRun?: boolean } = {},
  ): Promise<number> {
    if (rows.length === 0) return 0;

    // Build $1, $2, ... placeholders per row.
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 0;
    for (const row of rows) {
      const ph = columns.map(() => `$${++idx}`);
      placeholders.push(`(${ph.join(', ')})`);
      for (const col of columns) values.push(row[col]);
    }

    const sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (${conflictTarget}) DO NOTHING
      RETURNING 1
    `;

    if (opts.dryRun) {
      this.log.info(`[dry-run] would INSERT ${rows.length} rows into ${table}`, {
        sample: rows.slice(0, 3),
      });
      return 0;
    }

    const { rowCount } = await client.query(sql, values);
    return rowCount ?? 0;
  }
}
