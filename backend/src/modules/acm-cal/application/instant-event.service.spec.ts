import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import { REDIS_CLIENT } from '../../../infrastructure/config/redis.provider';
import { CalEventService } from './cal-event.service';
import { CalInviteeService } from './cal-invitee.service';
import { InstantEventService } from './instant-event.service';

/**
 * Behaviors covered:
 *  1. defaults: BODASCHOOL / category=CLASS / source=INSTANT applied
 *  2. blank title → autogen "즉시 강의 - <name> HH:mm"
 *  3. explicit title preserved + trimmed
 *  4. evtEndAt = now + durationMin
 *  5. launcherUrl appends ?autoStart=1 (and works when meetingUrl already
 *     has query string)
 *  6. idempotency: same actor + same key returns prior evtId without
 *     calling CalEventService.create again
 *  7. invitee count + notify summary forwarded
 */
describe('InstantEventService', () => {
  let svc: InstantEventService;
  let calCreate: jest.Mock;
  let userFindOne: jest.Mock;
  let evtFindOne: jest.Mock;
  let evtFindOneOrFail: jest.Mock;
  let evtUpdate: jest.Mock;
  let inviteeListForEvent: jest.Mock;
  let redisGet: jest.Mock;
  let redisSet: jest.Mock;

  const SAVED_ID = '11111111-2222-3333-4444-555555555555';

  beforeEach(async () => {
    calCreate = jest.fn();
    userFindOne = jest.fn().mockResolvedValue({ name: '김교사' });
    evtFindOne = jest.fn();
    evtFindOneOrFail = jest.fn();
    evtUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    inviteeListForEvent = jest.fn().mockResolvedValue([]);
    redisGet = jest.fn().mockResolvedValue(null);
    redisSet = jest.fn().mockResolvedValue('OK');

    const mod = await Test.createTestingModule({
      providers: [
        InstantEventService,
        {
          provide: CalEventService,
          useValue: { create: calCreate } as Partial<CalEventService>,
        },
        {
          provide: CalInviteeService,
          useValue: {
            listForEvent: inviteeListForEvent,
          } as Partial<CalInviteeService>,
        },
        {
          provide: getRepositoryToken(AcmUserTypeormEntity, ACM_DS),
          useValue: { findOne: userFindOne },
        },
        {
          provide: getRepositoryToken(CalEventTypeormEntity, ACM_DS),
          useValue: {
            findOne: evtFindOne,
            findOneOrFail: evtFindOneOrFail,
            update: evtUpdate,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              k === 'FRONTEND_URL' ? 'https://acm.amoeba.site' : undefined,
          } as unknown as ConfigService,
        },
        { provide: REDIS_CLIENT, useValue: { get: redisGet, set: redisSet } },
      ],
    }).compile();

    svc = mod.get(InstantEventService);
  });

  function arrangeSuccessfulCreate(opts: {
    meetingUrl?: string;
    invitees?: unknown[];
    notifySummary?: unknown;
  } = {}) {
    const startAt = new Date('2026-06-10T05:00:00Z');
    const endAt = new Date('2026-06-10T06:30:00Z');
    calCreate.mockResolvedValue({
      id: SAVED_ID,
      entId: 'ent-1',
      ownerUserId: 'u-teacher',
      category: 'CLASS',
      title: '즉시 강의 - 김교사 14:00',
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      meetingProvider: 'BODASCHOOL',
      meetingUrl: opts.meetingUrl ?? `https://acm.amoeba.site/portal/classroom/${SAVED_ID}`,
      invitees: opts.invitees ?? [],
      notifySummary: opts.notifySummary ?? null,
    });
    evtFindOneOrFail.mockResolvedValue({
      id: SAVED_ID,
      entId: 'ent-1',
      ownerUserId: 'u-teacher',
      meetingUrl: opts.meetingUrl ?? `https://acm.amoeba.site/portal/classroom/${SAVED_ID}`,
      startAt,
      endAt,
    });
  }

  // ----------------------------------------------------------
  it('applies BODASCHOOL + INSTANT defaults to the cal event', async () => {
    arrangeSuccessfulCreate();

    await svc.create('ent-1', 'u-teacher', 'TEACHER', {
      durationMin: 90,
      invitees: [],
    });

    const arg = calCreate.mock.calls[0][3];
    expect(arg).toMatchObject({
      evtCategory: 'CLASS',
      evtMeetingProvider: 'BODASCHOOL',
      evtAllDay: false,
    });
    // After cal create, evt_source forced to INSTANT.
    expect(evtUpdate).toHaveBeenCalledWith({ id: SAVED_ID }, { source: 'INSTANT' });
  });

  it('autogenerates title when omitted', async () => {
    arrangeSuccessfulCreate();
    await svc.create('ent-1', 'u-teacher', 'TEACHER', { durationMin: 60 });

    const arg = calCreate.mock.calls[0][3];
    expect(arg.evtTitle).toMatch(/^즉시 강의 - 김교사 \d{2}:\d{2}$/);
  });

  it('keeps explicit title trimmed', async () => {
    arrangeSuccessfulCreate();
    await svc.create('ent-1', 'u-teacher', 'TEACHER', {
      durationMin: 60,
      title: '   토요 보충   ',
    });

    expect(calCreate.mock.calls[0][3].evtTitle).toBe('토요 보충');
  });

  it('sets evtEndAt = now + durationMin', async () => {
    arrangeSuccessfulCreate();
    const before = Date.now();
    await svc.create('ent-1', 'u-teacher', 'TEACHER', { durationMin: 30 });
    const after = Date.now();

    const arg = calCreate.mock.calls[0][3];
    const start = new Date(arg.evtStartAt).getTime();
    const end = new Date(arg.evtEndAt).getTime();
    expect(end - start).toBe(30 * 60_000);
    // start ≈ now (clock-skew tolerant)
    expect(start).toBeGreaterThanOrEqual(before);
    expect(start).toBeLessThanOrEqual(after);
  });

  it('launcherUrl always carries ?autoStart=1 (and merges existing query)', async () => {
    arrangeSuccessfulCreate({
      meetingUrl: `https://acm.amoeba.site/portal/classroom/${SAVED_ID}?foo=bar`,
    });
    const r = await svc.create('ent-1', 'u-teacher', 'TEACHER', { durationMin: 60 });
    expect(r.launcherUrl).toBe(
      `https://acm.amoeba.site/portal/classroom/${SAVED_ID}?foo=bar&autoStart=1`,
    );
  });

  it('idempotency: same key + same actor returns prior evtId, no second create', async () => {
    arrangeSuccessfulCreate();
    redisGet.mockResolvedValueOnce(SAVED_ID); // cache hit
    evtFindOne.mockResolvedValue({
      id: SAVED_ID,
      entId: 'ent-1',
      startAt: new Date('2026-06-10T05:00:00Z'),
      endAt: new Date('2026-06-10T06:30:00Z'),
      meetingUrl: `https://acm.amoeba.site/portal/classroom/${SAVED_ID}`,
    });
    inviteeListForEvent.mockResolvedValue([
      { kind: 'STUDENT', refId: 'std-1' },
      { kind: 'STUDENT', refId: 'std-2' },
    ]);

    const r = await svc.create(
      'ent-1',
      'u-teacher',
      'TEACHER',
      { durationMin: 60 },
      'idem-abc',
    );

    expect(r.evtId).toBe(SAVED_ID);
    expect(r.deduped).toBe(true);
    expect(r.invitedCount).toBe(2);
    expect(calCreate).not.toHaveBeenCalled();
  });

  it('stores idempotency mapping after first successful create', async () => {
    arrangeSuccessfulCreate();
    await svc.create(
      'ent-1',
      'u-teacher',
      'TEACHER',
      { durationMin: 60 },
      'idem-new',
    );
    expect(redisSet).toHaveBeenCalledWith(
      expect.stringContaining('instant-event:idem:u-teacher:idem-new'),
      SAVED_ID,
      'EX',
      600,
      'NX',
    );
  });

  it('forwards invitee count + notify summary in the response', async () => {
    const summary = { sent: 2, failed: 0, skipped: 1 };
    arrangeSuccessfulCreate({
      invitees: [{ kind: 'STUDENT', refId: 'a' }, { kind: 'STUDENT', refId: 'b' }],
      notifySummary: summary,
    });

    const r = await svc.create('ent-1', 'u-teacher', 'TEACHER', {
      durationMin: 90,
      invitees: [
        { kind: 'STUDENT', refId: 'a' },
        { kind: 'STUDENT', refId: 'b' },
      ],
    });

    expect(r.invitedCount).toBe(2);
    expect(r.notifySummary).toEqual(summary);
    expect(r.deduped).toBe(false);
  });

  it('meetKey is tac-{evtId hex 32}', async () => {
    arrangeSuccessfulCreate();
    const r = await svc.create('ent-1', 'u-teacher', 'TEACHER', { durationMin: 60 });
    expect(r.meetKey).toBe(`tac-${SAVED_ID.replace(/-/g, '')}`);
  });
});
