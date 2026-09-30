import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { IcsImportService } from '../src/modules/acm-cal/application/ics/ics-import.service';
config({ path: process.env.ACM_TEST_ENV_FILE ?? '.env', quiet: true });
async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 5434,
    username: process.env.ACM_PG_USER || 'acm',
    password: process.env.ACM_PG_PASSWORD || 'acm',
    database: 'acm_lifecycle_test_260929',
  });
  await ds.initialize();
  const ent = randomUUID(),
    usr = randomUUID(),
    batch = randomUUID(),
    email = `ics-${usr}@example.invalid`;
  const text = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'X-WR-CALNAME:검증',
    'X-WR-TIMEZONE:Asia/Seoul',
    'BEGIN:VEVENT',
    'UID:test-infinite',
    'DTSTART:20260901T000000Z',
    'DTEND:20260901T010000Z',
    'RRULE:FREQ=WEEKLY;BYDAY=TU',
    'EXDATE:20260908T000000Z',
    'SUMMARY:수업',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:test-infinite',
    'RECURRENCE-ID:20260915T000000Z',
    'DTSTART:20260916T000000Z',
    'DTEND:20260916T010000Z',
    'SUMMARY:변경 수업',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  try {
    await ds.query(
      "INSERT INTO amb_acm_user(usr_id,ent_id,usr_email,usr_name,usr_role,usr_status) VALUES($1,$2,$3,'old','ADMIN','ACTIVE')",
      [usr, ent, email],
    );
    const svc = new IcsImportService(ds),
      files = [{ key: 'test.ics', text }];
    const count = async () =>
      (
        await ds.query(
          'SELECT count(*)::int AS n FROM amb_acm_cal_event WHERE ent_id=$1',
          [ent],
        )
      )[0].n;
    const dry = await svc.import(files, email, '검증', batch, false);
    assert(dry.created > 50);
    assert.equal(await count(), 0);
    const first = await svc.import(files, email, '검증', batch, true);
    assert.equal(first.created, dry.created);
    assert.equal(
      (await svc.import(files, email, '검증', batch, true)).created,
      0,
    );
    assert.equal(
      (
        await ds.query(
          "SELECT count(*)::int AS n FROM amb_acm_cal_event WHERE ent_id=$1 AND evt_start_at='2026-09-08T00:00Z'",
          [ent],
        )
      )[0].n,
      0,
    );
    const moved = (
      await ds.query(
        "SELECT evt_id FROM amb_acm_cal_event WHERE ent_id=$1 AND evt_start_at='2026-09-16T00:00Z'",
        [ent],
      )
    )[0];
    assert(moved);
    assert.equal(await svc.metadata(randomUUID(), moved.evt_id), null);
    await assert.rejects(() =>
      svc.stop(randomUUID(), moved.evt_id, usr, '2027-01-01T00:00Z'),
    );
    await ds.query(
      "UPDATE amb_acm_cal_event SET deleted_at=now(),evt_delete_reason='test',evt_deleted_by=$2 WHERE evt_id=$1",
      [moved.evt_id, usr],
    );
    await svc.ensureRange(ent, new Date('2028-10-01T00:00Z'));
    assert(
      (
        await ds.query(
          'SELECT deleted_at FROM amb_acm_cal_event WHERE evt_id=$1',
          [moved.evt_id],
        )
      )[0].deleted_at,
    );
    const n = await count();
    await svc.ensureRange(ent, new Date('2028-10-01T00:00Z'));
    assert.equal(await count(), n);
    const stopped = await svc.stop(ent, moved.evt_id, usr, '2027-01-01T00:00Z');
    assert(stopped.removed > 0);
    await svc.ensureRange(ent, new Date('2029-10-01T00:00Z'));
    assert.equal(
      (
        await ds.query(
          "SELECT count(*)::int AS n FROM amb_acm_cal_event WHERE ent_id=$1 AND evt_start_at>='2027-01-01T00:00Z' AND deleted_at IS NULL",
          [ent],
        )
      )[0].n,
      0,
    );
    console.log(
      'PASS: dry-run rollback, import, idempotency, EXDATE, moved occurrence, tenant isolation, deleted occurrence preservation, extension, stop',
    );
  } finally {
    for (const table of [
      'amb_acm_cal_ics_occurrence',
      'amb_acm_cal_ics_source',
      'amb_acm_cal_event',
    ])
      await ds.query(`DELETE FROM ${table} WHERE ent_id=$1`, [ent]);
    await ds.query('DELETE FROM amb_acm_user WHERE usr_id=$1', [usr]);
    await ds.destroy();
  }
}
void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
