import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ACM_DS } from '../../acm-common/datasource';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import { CalInviteeTypeormEntity } from '../infrastructure/typeorm/cal-invitee.typeorm-entity';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { BodaLaunchContextService } from './boda-launch-context.service';
import { BodaRoomService } from './boda-room.service';
import { BodaConfigService } from './boda-config.service';

describe('BodaLaunchContextService', () => {
  let svc: BodaLaunchContextService;
  let evtFindOne: jest.Mock;
  let inviteeFind: jest.Mock;
  let userFindOne: jest.Mock;
  let roomFindByEvtId: jest.Mock;
  let cfgFindByEntId: jest.Mock;

  beforeEach(async () => {
    evtFindOne = jest.fn();
    inviteeFind = jest.fn().mockResolvedValue([]);
    userFindOne = jest.fn().mockResolvedValue({ id: 'u1', name: '김교사' });
    roomFindByEvtId = jest.fn();
    cfgFindByEntId = jest.fn().mockResolvedValue({
      bodaWebUrl: 'https://bodaedu.kr',
      graceBeforeMin: 10,
      graceAfterMin: 15,
    });

    const mod = await Test.createTestingModule({
      providers: [
        BodaLaunchContextService,
        {
          provide: getRepositoryToken(CalEventTypeormEntity, ACM_DS),
          useValue: { findOne: evtFindOne },
        },
        {
          provide: getRepositoryToken(CalInviteeTypeormEntity, ACM_DS),
          useValue: { find: inviteeFind },
        },
        {
          provide: getRepositoryToken(AcmUserTypeormEntity, ACM_DS),
          useValue: { findOne: userFindOne },
        },
        {
          provide: BodaRoomService,
          useValue: { findByEvtId: roomFindByEvtId } as Partial<BodaRoomService>,
        },
        {
          provide: BodaConfigService,
          useValue: { findByEntId: cfgFindByEntId } as Partial<BodaConfigService>,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              k === 'BODA_WEB_URL' ? 'https://bodaedu.kr' : undefined,
          } as unknown as ConfigService,
        },
      ],
    }).compile();
    svc = mod.get(BodaLaunchContextService);
  });

  const evt = (
    overrides: Partial<CalEventTypeormEntity> = {},
  ): CalEventTypeormEntity =>
    ({
      id: '11111111-2222-3333-4444-555555555555',
      entId: 'e1',
      ownerUserId: 'teacher-1',
      title: '영어회화',
      startAt: new Date(Date.now() - 5 * 60_000), // started 5 min ago (in window)
      endAt: new Date(Date.now() + 55 * 60_000),
      meetingProvider: 'BODASCHOOL',
      meetingUrl: 'https://acm.amoeba.site/web/classroom/...',
      deletedAt: null,
      ...overrides,
    }) as unknown as CalEventTypeormEntity;

  const room = (
    overrides: Partial<{ status: string; meetIdx: string | null }> = {},
  ) =>
    ({
      meetKey: 'tac-11111111222233334444555555555555',
      roomCode: '699',
      status: 'OPEN',
      meetIdx: 'm-1',
      openedAt: new Date(),
      ...overrides,
    } as any);

  describe('build (launch-context)', () => {
    it('teacher (owner) → userType 11 + valid payload', async () => {
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(room());

      const ctx = await svc.build('11111111-2222-3333-4444-555555555555', 'e1', 'teacher-1', 'TEACHER');
      expect(ctx.userType).toBe(11);
      expect(ctx.meetKey).toBe('tac-11111111222233334444555555555555');
      expect(ctx.roomCode).toBe('699');
      expect(ctx.lang).toBe('ko');
      expect(ctx.appApiUrl).toBe('https://bodaedu.kr/BodaAppApi.js');
      // toBodaUid strips dashes from the ACM user UUID → vendor's UId (≤32hex).
      expect(ctx.uid).toBe('teacher1');
      // No leaking of authKey/secret values.
      expect(JSON.stringify(ctx)).not.toMatch(/authKey|secret/i);
    });

    it('student invitee → userType 12', async () => {
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(room());
      inviteeFind.mockResolvedValue([{ kind: 'STUDENT', refId: 'student-1' }]);

      const ctx = await svc.build(
        '11111111-2222-3333-4444-555555555555',
        'e1',
        'student-1',
        'STUDENT' as any,
      );
      expect(ctx.userType).toBe(12);
    });

    it('parent invitee → userType 12', async () => {
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(room());
      inviteeFind.mockResolvedValue([{ kind: 'PARENT', refId: 'parent-1' }]);

      const ctx = await svc.build(
        '11111111-2222-3333-4444-555555555555',
        'e1',
        'parent-1',
        'STUDENT' as any,
      );
      expect(ctx.userType).toBe(12);
    });

    it('ADMIN non-owner non-invitee → userType 13 (monitor)', async () => {
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(room());
      inviteeFind.mockResolvedValue([]);

      const ctx = await svc.build(
        '11111111-2222-3333-4444-555555555555',
        'e1',
        'admin-1',
        'ADMIN',
      );
      expect(ctx.userType).toBe(13);
    });

    it('outsider (not owner, not invitee, not admin) → 403 NOT_AN_ATTENDEE', async () => {
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(room());
      inviteeFind.mockResolvedValue([]);
      const err = await svc
        .build('11111111-2222-3333-4444-555555555555', 'e1', 'random', 'STUDENT' as any)
        .catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: 'NOT_AN_ATTENDEE',
      });
    });

    it('event not found → 404', async () => {
      evtFindOne.mockResolvedValue(null);
      const err = await svc
        .build('11111111-2222-3333-4444-555555555555', 'e1', 'u', 'TEACHER')
        .catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundException);
    });

    it('event provider != BODASCHOOL → 422', async () => {
      evtFindOne.mockResolvedValue(evt({ meetingProvider: 'GOOGLE_MEET' }));
      const err = await svc
        .build('11111111-2222-3333-4444-555555555555', 'e1', 'teacher-1', 'TEACHER')
        .catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'BODA_NOT_BODASCHOOL',
      });
    });

    it('room row missing (race) → 422 BODA_ROOM_NOT_PROVISIONED', async () => {
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(null);
      const err = await svc
        .build('11111111-2222-3333-4444-555555555555', 'e1', 'teacher-1', 'TEACHER')
        .catch((e) => e);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'BODA_ROOM_NOT_PROVISIONED',
      });
    });

    it('time window — before openAt → 403', async () => {
      evtFindOne.mockResolvedValue(
        evt({
          startAt: new Date(Date.now() + 30 * 60_000), // 30 min from now
          endAt: new Date(Date.now() + 90 * 60_000),
        }),
      );
      roomFindByEvtId.mockResolvedValue(room());
      const err = await svc
        .build('11111111-2222-3333-4444-555555555555', 'e1', 'teacher-1', 'TEACHER')
        .catch((e) => e);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'BODA_LAUNCH_OUT_OF_WINDOW',
      });
    });

    it('time window — after closeAt → 403', async () => {
      evtFindOne.mockResolvedValue(
        evt({
          startAt: new Date(Date.now() - 120 * 60_000),
          endAt: new Date(Date.now() - 30 * 60_000), // ended 30 min ago, 15min grace already past
        }),
      );
      roomFindByEvtId.mockResolvedValue(room());
      const err = await svc
        .build('11111111-2222-3333-4444-555555555555', 'e1', 'teacher-1', 'TEACHER')
        .catch((e) => e);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    });

    it('lang param defaults to ko when not "en"', async () => {
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(room());
      const ctx = await svc.build(
        '11111111-2222-3333-4444-555555555555',
        'e1',
        'teacher-1',
        'TEACHER',
        'zh-CN',
      );
      expect(ctx.lang).toBe('ko');
    });
  });

  describe('getStatus', () => {
    it('returns status timestamps but no leak of meetKey/UId', async () => {
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(room({ status: 'STARTED' as any }));
      const status = await svc.getStatus(
        '11111111-2222-3333-4444-555555555555',
        'e1',
        'teacher-1',
        'TEACHER',
      );
      expect(status.status).toBe('STARTED');
      expect(Object.keys(status)).toEqual(
        expect.arrayContaining(['status', 'openedAt', 'startedAt', 'endedAt', 'closedAt']),
      );
      expect(JSON.stringify(status)).not.toContain('meetKey');
    });

    it('NOT gated by time window (student can poll during PENDING)', async () => {
      evtFindOne.mockResolvedValue(
        evt({
          startAt: new Date(Date.now() + 30 * 60_000),
          endAt: new Date(Date.now() + 90 * 60_000),
        }),
      );
      roomFindByEvtId.mockResolvedValue(room({ status: 'PENDING' as any }));
      const status = await svc.getStatus(
        '11111111-2222-3333-4444-555555555555',
        'e1',
        'teacher-1',
        'TEACHER',
      );
      expect(status.status).toBe('PENDING');
    });
  });
});
