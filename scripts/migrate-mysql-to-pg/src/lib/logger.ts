/**
 * Minimal structured logger for the migration CLI.
 *
 * Why custom: nest/pino-style frameworks pull in too much for a one-shot
 * Node script. Output is line-delimited so it can be piped to `tee` and
 * uploaded as a deploy artifact.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_COLOR: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

export class Logger {
  constructor(private readonly scope: string) {}

  private emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
    const ts = new Date().toISOString();
    const color = process.stdout.isTTY ? LEVEL_COLOR[level] : '';
    const reset = process.stdout.isTTY ? RESET : '';
    const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
    // eslint-disable-next-line no-console
    console.log(`${ts} ${color}${level.toUpperCase().padEnd(5)}${reset} [${this.scope}] ${msg}${metaStr}`);
  }

  debug(msg: string, meta?: Record<string, unknown>): void { this.emit('debug', msg, meta); }
  info(msg: string,  meta?: Record<string, unknown>): void { this.emit('info',  msg, meta); }
  warn(msg: string,  meta?: Record<string, unknown>): void { this.emit('warn',  msg, meta); }
  error(msg: string, meta?: Record<string, unknown>): void { this.emit('error', msg, meta); }

  /** Progress bar for batched operations — repaints the current row. */
  progress(table: string, done: number, total: number | null): void {
    const pct = total ? ((done / total) * 100).toFixed(1) : '?';
    const tStr = total !== null ? total.toLocaleString() : 'unknown';
    this.info(`progress ${table}`, { done, total: tStr, pct });
  }
}
