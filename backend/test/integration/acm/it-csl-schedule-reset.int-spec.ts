import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { validate } from 'class-validator';
import { LevelTestScheduleResetService } from '../../../src/modules/acm-csl/application/level-test-schedule-reset.service';
import { ResetLevelTestScheduleDto } from '../../../src/modules/acm-csl/application/dto/reset-level-test-schedule.dto';
import { InquiryTypeormEntity } from '../../../src/modules/acm-csl/infrastructure/typeorm/inquiry.typeorm-entity';
import { MapTestTypeormEntity } from '../../../src/modules/acm-csl/infrastructure/typeorm/map-test.typeorm-entity';
import { CalEventTypeormEntity } from '../../../src/modules/acm-cal/infrastructure/typeorm/cal-event.typeorm-entity';

describe('level-test schedule reset (PostgreSQL)', () => {
  let pg: StartedPostgreSqlContainer,
    ds: DataSource,
    service: LevelTestScheduleResetService;
  const ent = randomUUID(),
    inq = randomUUID(),
    id = randomUUID(),
    event = randomUUID(),
    actor = randomUUID(),
    teacher = randomUUID();
  const snapshot = {
    scheduledAt: '2026-09-25',
    scheduledTime: '14:00:00',
    calEventId: event,
  };
  beforeAll(async () => {
    pg = await new PostgreSqlContainer(
      process.env.ACM_TEST_PG_IMAGE ?? 'tac-postgres-acm:pg16-bigm',
    )
      .withPullPolicy({ shouldPull: () => false })
      .start();
    ds = await new DataSource({
      type: 'postgres',
      url: pg.getConnectionUri(),
      entities: [
        InquiryTypeormEntity,
        MapTestTypeormEntity,
        CalEventTypeormEntity,
      ],
      synchronize: true,
    }).initialize();
    await ds.query(
      'CREATE TABLE amb_acm_csl_trial_class(tcl_cal_event_id uuid)',
    );
    service = new LevelTestScheduleResetService(ds);
  });
  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (pg) await pg.stop();
  });
  beforeEach(async () => {
    await ds.query(
      'TRUNCATE amb_acm_csl_inquiry,amb_acm_csl_map_test,amb_acm_cal_event,amb_acm_csl_trial_class',
    );
    await ds.getRepository(InquiryTypeormEntity).save({
      id: inq,
      entId: ent,
      seqNo: 1,
      registeredAt: '2026-09-23',
      nameEncrypted: Buffer.from('test'),
      nameIv: Buffer.from('test'),
      nameAuthTag: Buffer.from('test'),
      inflowType: 'PHONE',
      applyType: 'EXAM_ONLY',
    });
    await ds.getRepository(CalEventTypeormEntity).save({
      id: event,
      entId: ent,
      ownerUserId: actor,
      title: 'Test fixture',
      category: 'LEVEL_TEST',
      source: 'MANUAL',
      meetingProvider: 'NONE',
      startAt: new Date('2026-09-25T05:00:00Z'),
      endAt: new Date('2026-09-25T06:00:00Z'),
    });
    await ds.getRepository(MapTestTypeormEntity).save({
      id,
      entId: ent,
      inqId: inq,
      testType: 'MAP',
      ...snapshot,
      teacherId: teacher,
      scoreReading: 230,
      scheduledStatus: 'COMPLETED',
    });
  });
  const reset = (s = snapshot) =>
    service.reset(ent, inq, 'MAP', actor, 'ADMIN', s);
  it('atomically clears schedule, records deletion actor and preserves results, teacher and other test', async () => {
    const second = randomUUID();
    await ds.getRepository(MapTestTypeormEntity).save({
      id: second,
      entId: ent,
      inqId: inq,
      testType: 'ISEE',
      scheduledAt: '2026-09-26',
    });
    await reset();
    expect(
      await ds.getRepository(MapTestTypeormEntity).findOneByOrFail({ id }),
    ).toMatchObject({
      scheduledAt: null,
      scheduledTime: null,
      calEventId: null,
      teacherId: teacher,
      scoreReading: 230,
      scheduledStatus: 'COMPLETED',
    });
    const e = await ds
      .getRepository(CalEventTypeormEntity)
      .findOneByOrFail({ id: event });
    expect(e.deletedAt).toBeInstanceOf(Date);
    expect(e.deletedBy).toBe(actor);
    expect(
      (
        await ds
          .getRepository(MapTestTypeormEntity)
          .findOneByOrFail({ id: second })
      ).scheduledAt,
    ).toBe('2026-09-26');
    await expect(reset()).resolves.toEqual({ reset: true });
  });
  it('rejects stale snapshots, cross-tenant and unauthorized requests', async () => {
    await expect(
      reset({ ...snapshot, scheduledAt: '2026-09-24' }),
    ).rejects.toThrow('SCHEDULE_CHANGED');
    await expect(
      service.reset(randomUUID(), inq, 'MAP', actor, 'ADMIN', snapshot),
    ).rejects.toThrow('INQUIRY_NOT_FOUND');
    await expect(
      service.reset(ent, inq, 'MAP', actor, 'TEACHER', snapshot),
    ).rejects.toThrow('FORBIDDEN');
    await expect(
      service.reset(ent, inq, 'MAP', randomUUID(), 'STAFF', snapshot),
    ).rejects.toThrow('NOT_OWNER');
    expect(
      (
        await ds
          .getRepository(CalEventTypeormEntity)
          .findOneByOrFail({ id: event })
      ).deletedAt,
    ).toBeNull();
  });
  it('rejects shared and external meeting links without deleting anything', async () => {
    await ds.query('INSERT INTO amb_acm_csl_trial_class VALUES($1)', [event]);
    await expect(reset()).rejects.toThrow('SCHEDULE_LINK_SHARED');
    await ds.query('TRUNCATE amb_acm_csl_trial_class');
    await ds
      .getRepository(CalEventTypeormEntity)
      .update(event, { meetingProvider: 'BODASCHOOL' });
    await expect(reset()).rejects.toThrow('SCHEDULE_EXTERNAL_MEETING');
    expect(
      (await ds.getRepository(MapTestTypeormEntity).findOneByOrFail({ id }))
        .scheduledAt,
    ).toBe(snapshot.scheduledAt);
  });
  it('rolls calendar deletion back if clearing the test row fails', async () => {
    await ds.query(
      `ALTER TABLE amb_acm_csl_map_test ADD CONSTRAINT fixture_require_schedule CHECK(mpt_scheduled_at IS NOT NULL)`,
    );
    try {
      await expect(reset()).rejects.toThrow();
      expect(
        (
          await ds
            .getRepository(CalEventTypeormEntity)
            .findOneByOrFail({ id: event })
        ).deletedAt,
      ).toBeNull();
    } finally {
      await ds.query(
        'ALTER TABLE amb_acm_csl_map_test DROP CONSTRAINT fixture_require_schedule',
      );
    }
  });
  it('clears already deleted and missing calendar links, then permits rescheduling', async () => {
    await ds.getRepository(CalEventTypeormEntity).delete(event);
    await reset();
    await service.withLock(ent, inq, async (manager) => {
      await manager.update(MapTestTypeormEntity, id, {
        scheduledAt: '2026-09-27',
        scheduledTime: '15:00:00',
      });
    });
    expect(
      (await ds.getRepository(MapTestTypeormEntity).findOneByOrFail({ id }))
        .scheduledAt,
    ).toBe('2026-09-27');
  });
  it('serializes schedule updates and detects the stale reset after waiting', async () => {
    let release!: () => void, entered!: () => void;
    const ready = new Promise<void>((r) => (entered = r)),
      gate = new Promise<void>((r) => (release = r));
    const update = service.withLock(ent, inq, async (manager) => {
      entered();
      await gate;
      await manager.update(MapTestTypeormEntity, id, {
        scheduledAt: '2026-09-28',
      });
    });
    await ready;
    const attempt = reset();
    const assertion = expect(attempt).rejects.toThrow('SCHEDULE_CHANGED');
    release();
    await update;
    await assertion;
  });
  it('clears an already-deleted calendar without altering its deletion audit', async () => {
    await ds
      .getRepository(CalEventTypeormEntity)
      .update(event, {
        deletedAt: new Date(),
        deleteReason: 'previous deletion',
      });
    await reset();
    expect(
      (
        await ds
          .getRepository(CalEventTypeormEntity)
          .findOneByOrFail({ id: event })
      ).deleteReason,
    ).toBe('previous deletion');
  });
  it('resets an unlinked schedule with no teacher and never creates a missing test', async () => {
    await ds
      .getRepository(MapTestTypeormEntity)
      .update(id, { calEventId: null, teacherId: null });
    await service.reset(ent, inq, 'MAP', actor, 'STAFF', {
      ...snapshot,
      calEventId: null,
    });
    expect(
      (await ds.getRepository(MapTestTypeormEntity).findOneByOrFail({ id }))
        .teacherId,
    ).toBeNull();
    await expect(
      service.reset(ent, inq, 'ISEE', actor, 'ADMIN', snapshot),
    ).rejects.toThrow('LEVEL_TEST_NOT_FOUND');
  });
  it('requires snapshot keys but accepts explicit null values', async () => {
    expect((await validate(new ResetLevelTestScheduleDto())).length).toBe(3);
    expect(
      await validate(
        Object.assign(new ResetLevelTestScheduleDto(), {
          scheduledAt: null,
          scheduledTime: null,
          calEventId: null,
        }),
      ),
    ).toHaveLength(0);
  });
});
