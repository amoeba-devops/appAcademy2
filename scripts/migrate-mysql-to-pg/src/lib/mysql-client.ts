import * as mysql from 'mysql2/promise';
import type { MysqlConfig } from '../config';
import { Logger } from './logger';

/**
 * Thin wrapper around mysql2/promise. Read-only operations only — the
 * migration runner never issues UPDATE/DELETE against MySQL.
 *
 * BLOB / VARBINARY 컬럼은 `Buffer` 로 반환됨 (mysql2 기본). PG 측 `BYTEA`
 * 로 그대로 INSERT 가능 — 재암호화 X (REQ-260622 NFR-MYSQL-OUT-5).
 */
export class MysqlClient {
  private pool: mysql.Pool | null = null;
  private readonly log = new Logger('mysql');

  constructor(private readonly cfg: MysqlConfig) {}

  async connect(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.cfg.host,
      port: this.cfg.port,
      user: this.cfg.user,
      password: this.cfg.password,
      database: this.cfg.database,
      connectionLimit: 5,
      // Server timezone defaults to local; we explicitly cast DATETIME to
      // UTC in migrators when constructing PG TIMESTAMPTZ.
      timezone: '+09:00',
      // VARBINARY → Buffer (default). Don't auto-cast TINYINT(1) to bool —
      // some legacy migrations use 0/1 with no schema constraint.
      typeCast: function (field, next) {
        if (field.type === 'BIT' && field.length === 1) {
          const bytes = field.buffer();
          return bytes ? bytes[0] === 1 : false;
        }
        return next();
      },
    });
    // Verify connectivity.
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT 1 AS ok');
    if (!rows || rows[0]?.ok !== 1) {
      throw new Error('MySQL ping failed');
    }
    this.log.info('connected', { host: this.cfg.host, db: this.cfg.database });
  }

  async close(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  private requirePool(): mysql.Pool {
    if (!this.pool) throw new Error('MySQL not connected — call connect() first');
    return this.pool;
  }

  /** Returns COUNT(*) for a table. */
  async count(table: string, where?: string): Promise<number> {
    const sql = `SELECT COUNT(*) AS c FROM \`${table}\`${where ? ` WHERE ${where}` : ''}`;
    const [rows] = await this.requirePool().query<mysql.RowDataPacket[]>(sql);
    return Number(rows[0]?.c ?? 0);
  }

  /**
   * Iterate over a table in batches ordered by `orderBy` column (must be
   * indexed). Keyset pagination (lastId > N) — avoids OFFSET cost on big
   * tables.
   */
  async *iterate<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    opts: {
      orderBy: string;
      batchSize: number;
      where?: string;
      columns?: string[];
      limit?: number;
    },
  ): AsyncGenerator<T[]> {
    const cols = opts.columns?.length ? opts.columns.map((c) => `\`${c}\``).join(', ') : '*';
    let lastId: bigint | null = null;
    let yielded = 0;
    while (true) {
      const cursor: string = lastId === null ? '' : `AND \`${opts.orderBy}\` > ${lastId}`;
      const filter: string = opts.where
        ? `WHERE ${opts.where} ${cursor}`
        : cursor
          ? `WHERE 1=1 ${cursor}`
          : '';
      const remaining: number = opts.limit
        ? Math.min(opts.batchSize, opts.limit - yielded)
        : opts.batchSize;
      if (remaining <= 0) break;
      const sql: string = `SELECT ${cols} FROM \`${table}\` ${filter} ORDER BY \`${opts.orderBy}\` ASC LIMIT ${remaining}`;
      const [rows] = await this.requirePool().query<mysql.RowDataPacket[]>(sql);
      const fetched: mysql.RowDataPacket[] = rows;
      if (fetched.length === 0) break;
      yield fetched as T[];
      yielded += fetched.length;
      lastId = BigInt(
        (fetched[fetched.length - 1] as Record<string, unknown>)[opts.orderBy] as string | number,
      );
      if (fetched.length < remaining) break;
    }
  }

  /** Convenience — fetch a single row (or null). */
  async findOne<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const [rows] = await this.requirePool().query<mysql.RowDataPacket[]>(sql, params);
    return (rows[0] as T) ?? null;
  }
}
