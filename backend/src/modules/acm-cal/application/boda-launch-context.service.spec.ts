import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ACM_DS } from '../../acm-common/datasource';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import { CalInviteeTypeormEntity } from '../infrastructure/typeorm/cal-invitee.typeorm-entity';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { ParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { StudentParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student-parent.typeorm-entity';
import { ClassStudentTypeormEntity } from '../../acm-cls/infrastructure/typeorm/class-student.typeorm-entity';
import { TeacherTypeormEntity } from '../../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { BodaLaunchContextService } from './boda-launch-context.service';
import { BodaRoomService } from './boda-room.service';
import { BodaConfigService } from './boda-config.service';
import { CalInviteeService } from './cal-invitee.service';

describe('BodaLaunchContextService', () => {
  let svc: BodaLaunchContextService;
  let evtFindOne: jest.Mock;
  let inviteeFind: jest.Mock;
  let inviteeFindOne: jest.Mock;
  let userFindOne: jest.Mock;
  let stdFind: jest.Mock;
  let stdFindOne: jest.Mock;
  let cstFindOne: jest.Mock;
  let roomFindByEvtId: jest.Mock;
  let cfgFindByEntId: jest.Mock;
  let inviteeListForEvent: jest.Mock;
  let cfgEnv: Record<string, string | undefined>;

  beforeEach(async () => {
    evtFindOne = jest.fn();
    inviteeFind = jest.fn().mockResolvedValue([]);
    inviteeFindOne = jest.fn().mockResolvedValue(null);
    userFindOne = jest
      .fn()
      .mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'teacher-1') return Promise.resolve({ id: 'teacher-1', name: '김교사' });
        return Promise.resolve({ id: where.id, name: 'User' });
      });
    stdFind = jest.fn().mockResolvedValue([]);
    stdFindOne = jest.fn().mockResolvedValue({ id: 'std-1', name: '학생일' });
    cstFindOne = jest.fn().mockResolvedValue(null);
    roomFindByEvtId = jest.fn();
    cfgFindByEntId = jest.fn().mockResolvedValue({
      bodaWebUrl: 'https://bodaedu.kr',
      webrtcUrl: 'https://bodaedu.kr/webrtc',
      companyCode: '245',
      companyId: 'tpi',
      graceBeforeMin: 10,
      graceAfterMin: 15,
    });
    inviteeListForEvent = jest.fn().mockResolvedValue([]);
    cfgEnv = { BODA_WEB_URL: 'https://bodaedu.kr' };

    const mod = await Test.createTestingModule({
      providers: [
        BodaLaunchContextService,
        {
          provide: getRepositoryToken(CalEventTypeormEntity, ACM_DS),
          useValue: { findOne: evtFindOne },
        },
        {
          provide: getRepositoryToken(CalInviteeTypeormEntity, ACM_DS),
          useValue: { find: inviteeFind, findOne: inviteeFindOne },
        },
        {
          provide: getRepositoryToken(AcmUserTypeormEntity, ACM_DS),
          useValue: { findOne: userFindOne },
        },
        {
          provide: getRepositoryToken(StudentTypeormEntity, ACM_DS),
          useValue: { find: stdFind, findOne: stdFindOne },
        },
        {
          provide: getRepositoryToken(ParentTypeormEntity, ACM_DS),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(StudentParentTypeormEntity, ACM_DS),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(ClassStudentTypeormEntity, ACM_DS),
          useValue: { findOne: cstFindOne },
        },
        {
          provide: getRepositoryToken(TeacherTypeormEntity, ACM_DS),
          useValue: { findOne: jest.fn().mockResolvedValue({ id: 'tch-9', name: '김강사' }) },
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
          provide: CalInviteeService,
          useValue: {
            listForEvent: inviteeListForEvent,
          } as Partial<CalInviteeService>,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) => cfgEnv[k],
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
      meetingUrl: 'https://acm.amoeba.site/portal/classroom/...',
      deletedAt: null,
      source: 'MANUAL',
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
      // FIX-260703: 자체 호스팅 SDK (vendor 호스트는 text/html 반환).
      expect(ctx.appApiUrl).toBe('/web/BODA_APP/build/BodaAppApi.js');
      // SPEC_823 v823.002 — bodaOpen()/bodaJoin() 1st positional arg + joinUser company ids.
      expect(ctx.bodaWeb).toBe('https://bodaedu.kr');
      expect(ctx.companyId).toBe('tpi');
      expect(ctx.companyCode).toBe('245');
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

    // ────────────────────────────────────────────────────────────────
    // REQ-260619 FR-LX-4 — ownerName / evtSource / invitees / embedUrl
    // ────────────────────────────────────────────────────────────────

    it('FR-LX-4: ownerName populated from acm_user lookup', async () => {
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(room());
      const ctx = await svc.build(
        '11111111-2222-3333-4444-555555555555',
        'e1',
        'teacher-1',
        'TEACHER',
      );
      expect(ctx.ownerName).toBe('김교사');
      expect(ctx.evtSource).toBe('MANUAL');
    });

    it('FR-LX-4: teacher viewer → full invitees list with subLabel', async () => {
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(room());
      inviteeListForEvent.mockResolvedValue([
        { id: 'i1', kind: 'STUDENT', refId: 'std-1', name: '박학생', email: null, notifyStatus: 'SENT', notifiedAt: new Date(), notifyError: null },
        { id: 'i2', kind: 'STUDENT', refId: 'std-2', name: '이학생', email: null, notifyStatus: 'SKIPPED', notifiedAt: null, notifyError: null },
      ]);
      stdFind.mockResolvedValue([
        { id: 'std-1', school: '중학교A', grade: '3' },
      ]);

      const ctx = await svc.build(
        '11111111-2222-3333-4444-555555555555',
        'e1',
        'teacher-1',
        'TEACHER',
      );
      expect(ctx.invitees).toHaveLength(2);
      expect(ctx.invitees[0]).toMatchObject({
        kind: 'STUDENT',
        refId: 'std-1',
        name: '박학생',
        subLabel: '중학교A 3',
        notified: true,
      });
      expect(ctx.invitees[1]).toMatchObject({
        refId: 'std-2',
        subLabel: null,
        notified: false,
      });
    });

    it('FR-LX-4: student viewer (userType=12) → invitees masked to []', async () => {
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(room());
      inviteeFind.mockResolvedValue([{ kind: 'STUDENT', refId: 'student-1' }]);
      // Even if listForEvent would return rows, viewer masking returns empty array.
      inviteeListForEvent.mockResolvedValue([
        { id: 'i1', kind: 'STUDENT', refId: 'classmate-1', name: '다른학생', email: null, notifyStatus: 'SENT', notifiedAt: new Date(), notifyError: null },
      ]);

      const ctx = await svc.build(
        '11111111-2222-3333-4444-555555555555',
        'e1',
        'student-1',
        'STUDENT' as any,
      );
      expect(ctx.userType).toBe(12);
      expect(ctx.invitees).toEqual([]);
    });

    it('FR-LX-2: embedUrl is null when BODA_EMBED_ENABLED unset, webBrowserUrl always built from cfg', async () => {
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(room());
      const ctx = await svc.build(
        '11111111-2222-3333-4444-555555555555',
        'e1',
        'teacher-1',
        'TEACHER',
      );
      expect(ctx.embedUrl).toBeNull();
      expect(ctx.webBrowserUrl).toMatch(/^https:\/\/bodaedu\.kr\/webrtc\?/);
      expect(ctx.webBrowserUrl).toContain('CCd=245');
      expect(ctx.webBrowserUrl).toContain('meetKey=tac-');
      expect(ctx.webBrowserUrl).toContain('UTy=11');
    });

    it('FR-LX-2: embedUrl is populated when BODA_EMBED_ENABLED=true', async () => {
      cfgEnv.BODA_EMBED_ENABLED = 'true';
      evtFindOne.mockResolvedValue(evt());
      roomFindByEvtId.mockResolvedValue(room());
      const ctx = await svc.build(
        '11111111-2222-3333-4444-555555555555',
        'e1',
        'teacher-1',
        'TEACHER',
      );
      expect(ctx.embedUrl).toMatch(/^https:\/\/bodaedu\.kr\/webrtc\?/);
    });
  });

  // PLN-260715 — portal (student/parent) entry: identity + enrollment aware.
  describe('buildForPortal', () => {
    const EVT = '11111111-2222-3333-4444-555555555555';

    it('enrolled student (no invitee row) → userType 12 + browser url', async () => {
      evtFindOne.mockResolvedValue(evt({ clsId: 'cls-1' }));
      roomFindByEvtId.mockResolvedValue(room());
      inviteeFindOne.mockResolvedValue(null); // not an explicit invitee
      cstFindOne.mockResolvedValue({ cstId: 'x' }); // but enrolled in the class
      stdFindOne.mockResolvedValue({ id: 'std-9', name: '수강생' });

      const ctx = await svc.buildForPortal(EVT, 'e1', 'STUDENT', 'std-9', 'ko');
      expect(ctx.userType).toBe(12);
      expect(ctx.uname).toBe('수강생');
      expect(ctx.uid).toBe('std9');
      expect(ctx.webBrowserUrl).toContain('UTy=12');
      expect(ctx.invitees).toEqual([]);
    });

    it('student neither invitee nor enrolled → 403 NOT_AN_ATTENDEE', async () => {
      evtFindOne.mockResolvedValue(evt({ clsId: 'cls-1' }));
      roomFindByEvtId.mockResolvedValue(room());
      inviteeFindOne.mockResolvedValue(null);
      cstFindOne.mockResolvedValue(null);

      await expect(
        svc.buildForPortal(EVT, 'e1', 'STUDENT', 'std-x', 'ko'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('explicit student invitee → userType 12 (no enrollment lookup needed)', async () => {
      evtFindOne.mockResolvedValue(evt({ clsId: null }));
      roomFindByEvtId.mockResolvedValue(room());
      inviteeFindOne.mockResolvedValue({ kind: 'STUDENT', refId: 'std-9' });

      const ctx = await svc.buildForPortal(EVT, 'e1', 'STUDENT', 'std-9', 'en');
      expect(ctx.userType).toBe(12);
      expect(ctx.lang).toBe('en');
    });

    it('assigned teacher → userType 11 (can open room even while PENDING)', async () => {
      evtFindOne.mockResolvedValue(evt({ assigneeTchId: 'tch-9' }));
      roomFindByEvtId.mockResolvedValue(room({ status: 'PENDING', meetIdx: null }));

      const ctx = await svc.buildForPortal(EVT, 'e1', 'TEACHER', 'tch-9', 'ko');
      expect(ctx.userType).toBe(11);
      expect(ctx.uname).toBe('김강사');
      expect(ctx.roomCode).toBe('699');
    });

    it('non-assigned teacher (not invitee) → 403 NOT_AN_ATTENDEE', async () => {
      evtFindOne.mockResolvedValue(evt({ assigneeTchId: 'other-tch' }));
      roomFindByEvtId.mockResolvedValue(room());
      inviteeFindOne.mockResolvedValue(null);

      await expect(
        svc.buildForPortal(EVT, 'e1', 'TEACHER', 'tch-9', 'ko'),
      ).rejects.toThrow(ForbiddenException);
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
