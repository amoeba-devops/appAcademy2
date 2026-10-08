import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { CalEventService } from '../src/modules/acm-cal/application/cal-event.service';
import { CalInviteeService } from '../src/modules/acm-cal/application/cal-invitee.service';
import { CalColorService } from '../src/modules/acm-cal/application/cal-color.service';
import { RecurrenceService } from '../src/modules/acm-cal/application/recurrence.service';
import { VideoConfigService } from '../src/modules/acm-cal/application/video-config.service';
import { TenantSettingsService } from '../src/modules/acm-system/application/tenant-settings.service';
import { InviteeNotifierService } from '../src/modules/acm-cal/application/invitee-notifier.service';
import { BodaRoomService } from '../src/modules/acm-cal/application/boda-room.service';
import { BodaConfigService } from '../src/modules/acm-cal/application/boda-config.service';
import { CalEventTypeormEntity } from '../src/modules/acm-cal/infrastructure/typeorm/cal-event.typeorm-entity';
import { CalInviteeTypeormEntity } from '../src/modules/acm-cal/infrastructure/typeorm/cal-invitee.typeorm-entity';
import { TeacherTypeormEntity } from '../src/modules/acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { StudentTypeormEntity } from '../src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity';
import { ParentTypeormEntity } from '../src/modules/acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { BodaRoomTypeormEntity } from '../src/modules/acm-cal/infrastructure/typeorm/boda-room.typeorm-entity';
import type { CreateRecurrenceDto } from '../src/modules/acm-cal/application/dto/recurrence.dto';
config({ path: process.env.ACM_TEST_ENV_FILE ?? '.env', quiet: true });
async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 5434,
    username: process.env.ACM_PG_USER || 'acm',
    password: process.env.ACM_PG_PASSWORD || 'acm',
    database: 'acm_lifecycle_test_260929',
    entities: [__dirname + '/../src/modules/**/*.typeorm-entity.ts'],
  });
  await ds.initialize();
  await ds.query(
    readFileSync('../sql/acm/999t-acm-cal-video-config.sql', 'utf8'),
  );
  await ds.query(
    readFileSync('../sql/acm/1024-cal-colors-recurrence.sql', 'utf8'),
  );
  await ds.query(
    readFileSync('../sql/acm/1025-notification-inbox.sql', 'utf8'),
  );
  const ent = randomUUID(),
    user = randomUUID(),
    recipient = randomUUID();
  let notified = 0;
  const u = { entId: ent, id: user, role: 'ADMIN' as const };
  const video = new VideoConfigService(ds);
  const invites = new CalInviteeService(
    ds.getRepository(CalInviteeTypeormEntity),
    ds.getRepository(StudentTypeormEntity),
    ds.getRepository(TeacherTypeormEntity),
    ds.getRepository(ParentTypeormEntity),
  );
  const events = Object.assign(
    Object.create(CalEventService.prototype) as CalEventService,
    {
      repo: ds.getRepository(CalEventTypeormEntity),
      video,
      inviteeSvc: invites,
    },
  );
  const rooms = new BodaRoomService(
    ds.getRepository(BodaRoomTypeormEntity),
    { findByEntId: async () => null } as unknown as BodaConfigService,
    {} as never,
    new ConfigService({
      ACM_PORTAL_URL: 'http://localhost:5173',
      BODA_DEFAULT_ROOM_CODE: '699',
    }),
  );
  const svc = new RecurrenceService(
    ds,
    events,
    video,
    {
      getTimezone: async () => 'Asia/Seoul',
    } as unknown as TenantSettingsService,
    rooms,
    {
      notifyAdded: async () => {
        notified++;
        return { sent: 0, failed: 0, skippedNoEmail: 0, skippedNoSmtp: 0 };
      },
    } as unknown as InviteeNotifierService,
  );
  const colors = new CalColorService(ds);
  const dto: CreateRecurrenceDto = {
    requestId: randomUUID(),
    event: {
      evtTitle: 'Repeat PG test',
      evtCategory: 'OTHER',
      evtMeetingProvider: 'NONE',
      evtStartAt: '2030-10-04T00:00:00Z',
      evtEndAt: '2030-10-04T01:00:00Z',
    },
    rule: {
      kind: 'DAILY',
      interval: 1,
      excludeWeekends: true,
      end: 'UNTIL',
      until: '2030-10-10',
    },
  };
  const list = () =>
    ds.query(
      'SELECT e.*,o.cro_key FROM amb_acm_cal_event e JOIN amb_acm_cal_recurrence_occurrence o USING(evt_id,ent_id) WHERE e.ent_id=$1 ORDER BY o.cro_key',
      [ent],
    );
  try {
    await ds.query(
      "INSERT INTO amb_acm_user(usr_id,ent_id,usr_email,usr_name,usr_role,usr_status) VALUES($1,$2,$3,'Repeat test','ADMIN','ACTIVE')",
      [user, ent, `${user}@example.invalid`],
    );
    await ds.query(
      "INSERT INTO amb_acm_user(usr_id,ent_id,usr_email,usr_name,usr_role,usr_status) VALUES($1,$2,$3,'Recipient','STAFF','ACTIVE')",
      [recipient, ent, recipient + '@example.invalid'],
    );
    await colors.save(ent, [
      { kind: 'CATEGORY', target: 'CLASS', palette: 'rose' },
    ]);
    assert.equal((await colors.list(ent))[0].palette, 'rose');
    assert.deepEqual(await colors.list(randomUUID()), []);
    await assert.rejects(() =>
      colors.save(ent, [
        { kind: 'ASSIGNEE', target: randomUUID(), palette: 'blue' },
      ]),
    );
    assert.equal((await colors.list(ent)).length, 1);
    const bad = {
      ...dto,
      requestId: randomUUID(),
      event: { ...dto.event, evtAssigneeTchId: randomUUID() },
    };
    await assert.rejects(() => svc.create(u, bad));
    assert.equal((await list()).length, 0);
    const results = await Promise.all([
      svc.create(u, structuredClone(dto)),
      svc.create(u, structuredClone(dto)),
    ]);
    assert.equal(
      results.reduce((n, r) => n + r.created, 0),
      5,
    );
    assert.equal((await list()).length, 5);
    assert.equal(notified, 1);
    const [{ n: initialInboxCount }] = await ds.query(
      'SELECT count(*)::int AS n FROM amb_acm_notification_outbox WHERE ent_id=$1',
      [ent],
    );
    assert.equal(
      initialInboxCount,
      1,
      'series create/idempotent retry produces one summary',
    );
    await assert.rejects(() =>
      svc.create(u, { ...dto, event: { ...dto.event, evtTitle: 'changed' } }),
    );
    let rows = await list();
    const id = rows[0].evt_id;
    await assert.rejects(() =>
      svc.change(
        { ...u, id: randomUUID(), role: 'TEACHER' },
        id,
        { scope: 'ALL', version: 1, reason: 'forbidden' },
        true,
      ),
    );
    await assert.rejects(() =>
      svc.change(
        { ...u, entId: randomUUID() },
        id,
        { scope: 'ALL', version: 1, reason: 'forbidden' },
        true,
      ),
    );
    await svc.change(u, id, {
      scope: 'ONE',
      version: 1,
      reason: 'individual change',
      event: { evtTitle: 'Individual', evtEditReason: 'individual change' },
    });
    await assert.rejects(() =>
      svc.change(u, id, { scope: 'ALL', version: 1, reason: 'stale' }, true),
    );
    const impact = await svc.change(
      u,
      rows[1].evt_id,
      { scope: 'ALL', version: 2, reason: 'preview' },
      false,
      true,
    );
    assert.deepEqual(impact, { changed: 4, protected: 1 });
    await svc.change(u, rows[1].evt_id, {
      scope: 'ALL',
      version: 2,
      reason: 'bulk shift',
      event: {
        evtEditReason: 'bulk shift',
        evtTitle: 'Bulk',
        evtStartAt: '2030-10-07T02:00:00Z',
        evtEndAt: '2030-10-07T03:00:00Z',
      },
    });
    rows = await list();
    assert.equal(rows[0].evt_title, 'Individual');
    assert.equal(new Date(rows[1].evt_start_at).getUTCHours(), 2);
    await svc.change(
      u,
      rows[2].evt_id,
      { scope: 'ONE', version: 3, reason: 'delete occurrence' },
      true,
    );
    await svc.ensureRange(ent, new Date('2035-01-01'));
    assert.equal((await list()).length, 5);
    assert((await list())[2].deleted_at);
    const infinite = {
      ...dto,
      requestId: randomUUID(),
      event: {
        ...dto.event,
        evtStartAt: '2032-01-01T00:00Z',
        evtEndAt: '2032-01-01T01:00Z',
      },
      rule: {
        ...dto.rule,
        kind: 'MONTHLY' as const,
        end: 'UNTIL' as const,
        until: '2040-01-01',
      },
    };
    const inf = await svc.create(u, infinite);
    assert(inf.created >= 12);
    await svc.ensureRange(ent, new Date('2034-01-01'));
    const [future] = await ds.query(
      'SELECT evt_id FROM amb_acm_cal_recurrence_occurrence WHERE ent_id=$1 AND crs_id=$2 AND cro_key >= $3 ORDER BY cro_key LIMIT 1',
      [ent, inf.id, '2033-01-01'],
    );
    await svc.change(
      u,
      future.evt_id,
      { scope: 'FOLLOWING', version: 1, reason: 'stop future' },
      true,
    );
    const n = (await list()).length;
    await svc.ensureRange(ent, new Date('2036-01-01'));
    assert.equal((await list()).length, n);
    const boda = {
      ...dto,
      requestId: randomUUID(),
      event: { ...dto.event, evtMeetingProvider: 'BODASCHOOL' as const },
      rule: { ...dto.rule, count: 2 },
    };
    const b = await svc.create(u, boda);
    assert.equal(b.created, 2);
    assert.equal(
      (
        await ds.query('SELECT * FROM amb_acm_cal_boda_room WHERE ent_id=$1', [
          ent,
        ])
      ).length,
      2,
    );
    const protectedEvent = (await list())[1];
    await ds.query(
      'INSERT INTO amb_acm_cal_event_review(ent_id,evt_id) VALUES($1,$2)',
      [ent, protectedEvent.evt_id],
    );
    await assert.rejects(() =>
      svc.change(
        u,
        protectedEvent.evt_id,
        { scope: 'ONE', version: 4, reason: 'history protected' },
        true,
      ),
    );
    const changing = await svc.create(u, {
      ...boda,
      requestId: randomUUID(),
      event: { ...boda.event, evtCategory: 'REGULAR_CLASS' },
      rule: {
        kind: 'MONTHLY',
        interval: 1,
        excludeWeekends: false,
        end: 'UNTIL',
        until: '2040-01-01',
      },
    });
    await ds.query(
      "INSERT INTO amb_acm_cal_video_config(ent_id,vdc_provider) VALUES($1,'GOOGLE_MEET')",
      [ent],
    );
    const pending = await svc.create(u, {
      requestId: randomUUID(),
      event: { ...dto.event, evtCategory: 'REGULAR_CLASS', evtMeetingProvider: 'GOOGLE_MEET', evtMeetingUrl: '' },
      rule: { kind: 'DAILY', interval: 1, excludeWeekends: false, end: 'UNTIL', until: '2030-10-05' },
    });
    const pendingRows: {evt_id: string; evt_meeting_url: string | null}[] = await ds.query('SELECT e.evt_id,e.evt_meeting_url FROM amb_acm_cal_event e JOIN amb_acm_cal_recurrence_occurrence o ON o.evt_id=e.evt_id WHERE o.crs_id=$1 ORDER BY e.evt_start_at', [pending.id]);
    assert.equal(pendingRows.length, 2);
    assert(pendingRows.every(r => r.evt_meeting_url === null));
    await svc.change(u, pendingRows[0].evt_id, { scope: 'ONE', version: 1, reason: 'Add class link', event: { evtEditReason: 'Add class link', evtMeetingUrl: 'https://meet.google.com/abc-defg-hij' } });
    const links: typeof pendingRows = await ds.query('SELECT evt_id,evt_meeting_url FROM amb_acm_cal_event WHERE evt_id=ANY($1::uuid[])', [pendingRows.map(r => r.evt_id)]);
    assert.equal(links.find(r => r.evt_id === pendingRows[0].evt_id)?.evt_meeting_url, 'https://meet.google.com/abc-defg-hij');
    assert.equal(links.find(r => r.evt_id === pendingRows[1].evt_id)?.evt_meeting_url, null);
    await svc.change(u, pendingRows[0].evt_id, {scope: 'ONE', version: 2, reason: 'Clear link', event: {evtMeetingUrl: '', evtEditReason: 'Clear link'}});
    const [cleared] = await ds.query('SELECT evt_meeting_url FROM amb_acm_cal_event WHERE evt_id=$1', [pendingRows[0].evt_id]);
    assert.equal(cleared.evt_meeting_url, null);
    console.log('PASS: Google recurrence without links, later link on one occurrence only, clear stored link');
    await svc.ensureRange(ent, new Date('2037-01-01'));
    const statuses = await svc.generationStatus(u);
    assert(statuses.some((s: { id: string }) => s.id === changing.id));
    assert.deepEqual(
      await svc.generationStatus({ ...u, entId: randomUUID() }),
      [],
    );
    console.log(
      'PASS: PostgreSQL color persistence/tenant isolation/rollback; recurrence validation, concurrent idempotency, notification claim, scope changes, exceptions, stale version, delete preservation, extension, stop, transactional BODA rooms',
    );
  } finally {
    for (const table of [
      'amb_acm_notification_inbox',
      'amb_acm_notification_outbox',
      'amb_acm_cal_event_review',
      'amb_acm_cal_video_config',
      'amb_acm_cal_color_setting',
      'amb_acm_cal_recurrence_occurrence',
      'amb_acm_cal_recurrence_series',
      'amb_acm_cal_event_revision',
      'amb_acm_cal_invitee',
      'amb_acm_cal_boda_room',
      'amb_acm_cal_event',
      'amb_acm_user',
    ])
      await ds.query(`DELETE FROM ${table} WHERE ent_id=$1`, [ent]);
    await video.onModuleDestroy();
    await ds.destroy();
  }
}
void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
