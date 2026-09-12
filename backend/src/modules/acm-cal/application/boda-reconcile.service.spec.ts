import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  BODAEDU_SERVER_CLIENT,
  BodaeduUnavailableException,
  type IBodaeduServerClient,
} from '../../../infrastructure/external/bodaedu/interfaces/bodaedu-server-api.interface';
import { BodaRoomTypeormEntity } from '../infrastructure/typeorm/boda-room.typeorm-entity';
import { BodaParticipantTypeormEntity } from '../infrastructure/typeorm/boda-participant.typeorm-entity';
import { BodaConfigService } from './boda-config.service';
import { BodaReconcileService } from './boda-reconcile.service';

/**
 * Behaviors covered:
 *  1. sweep picks ENDED + reconciledAt=null rooms past grace
 *  2. sweep skips rooms within grace window
 *  3. reconcileRoom inserts unseen entries
 *  4. reconcileRoom updates open rows (no leftAt) when entry has leftAt
 *  5. reconcileRoom no-op on rows that already match
 *  6. sweep keeps reconciledAt=null when SERVER API is down (BodaeduUnavailable)
 *  7. successful reconcile sets reconciledAt + transitions to CLOSED
 */
describe('BodaReconcileService', () => {
  let svc: BodaReconcileService;
  let roomQuery: jest.Mock;
  let roomFindOne: jest.Mock;
  let roomSave: jest.Mock;
  let partFindOne: jest.Mock;
  let partSave: jest.Mock;
  let partCreate: jest.Mock;
  let partUpdate: jest.Mock;
  let cfgFindByEntId: jest.Mock;
  let getJoinLog: jest.Mock;
  let getMeetInfo: jest.Mock;

  const makeRoom = (
    overrides: Partial<BodaRoomTypeormEntity> = {},
  ): BodaRoomTypeormEntity => ({
    id: 'r-1',
    entId: 'ent-1',
    evtId: 'e-1',
    sesId: null,
    meetKey: 'tac-aaa',
    roomCode: 'r-100',
    meetIdx: 'M-1',
    status: 'ENDED',
    openedAt: new Date('2026-06-10T09:00:00Z'),
    startedAt: new Date('2026-06-10T09:05:00Z'),
    endedAt: new Date('2026-06-10T09:55:00Z'),
    closedAt: null,
    closeType: null,
    reconciledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  /**
   * sweep 은 raw SQL 로 후보(방 id + 실효 종료시각)를 뽑은 뒤 엔티티를 로드한다.
   * 두 경로를 함께 세팅한다.
   */
  const stageSweep = (room: BodaRoomTypeormEntity, effectiveEnd?: Date) => {
    roomQuery.mockResolvedValue([
      { bdr_id: room.id, effective_end: effectiveEnd ?? room.endedAt },
    ]);
    roomFindOne.mockResolvedValue(room);
  };

  beforeEach(async () => {
    roomQuery = jest.fn().mockResolvedValue([]);
    roomFindOne = jest.fn();
    roomSave = jest.fn(async (r) => r);
    partFindOne = jest.fn();
    partSave = jest.fn(async (r) => r);
    partCreate = jest.fn((dto) => ({ id: 'p-new', ...dto }));
    partUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    cfgFindByEntId = jest.fn().mockResolvedValue({ reconcileDelayMin: 10 });
    getJoinLog = jest.fn();
    getMeetInfo = jest.fn().mockResolvedValue(null);

    const mod = await Test.createTestingModule({
      providers: [
        BodaReconcileService,
        {
          provide: getRepositoryToken(BodaRoomTypeormEntity, ACM_DS),
          useValue: {
            query: roomQuery,
            findOne: roomFindOne,
            save: roomSave,
          },
        },
        {
          provide: getRepositoryToken(BodaParticipantTypeormEntity, ACM_DS),
          useValue: {
            findOne: partFindOne,
            save: partSave,
            create: partCreate,
            update: partUpdate,
          },
        },
        {
          provide: BodaConfigService,
          useValue: {
            findByEntId: cfgFindByEntId,
            getServerApiAuth: jest.fn().mockResolvedValue(null),
          } as Partial<BodaConfigService>,
        },
        {
          provide: BODAEDU_SERVER_CLIENT,
          useValue: {
            getJoinLog,
            getMeetInfo,
          } as Partial<IBodaeduServerClient>,
        },
      ],
    }).compile();
    svc = mod.get(BodaReconcileService);
  });

  // ----------------------------------------------------------
  // reconcileRoom — single-room logic
  // ----------------------------------------------------------

  it('reconcileRoom inserts unseen entries with refUserId reverse-mapped', async () => {
    const room = makeRoom();
    partFindOne.mockResolvedValue(null);
    getJoinLog.mockResolvedValue([
      {
        meetKey: room.meetKey,
        userId: 'aaaaaaaabbbbccccddddeeeeeeeeeeee',
        joinedAt: '2026-06-10T09:01:00Z',
        leftAt: '2026-06-10T09:50:00Z',
        totalSeconds: 2940,
        clientType: 'native',
      },
    ]);

    const r = await svc.reconcileRoom(room);
    expect(r).toEqual({ inserted: 1, updated: 0 });
    expect(partSave).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'r-1',
        bodaUserId: 'aaaaaaaabbbbccccddddeeeeeeeeeeee',
        // 32hex reverse-mapped to dash-uuid
        refUserId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        leftAt: new Date('2026-06-10T09:50:00Z'),
        totalSeconds: 2940,
      }),
    );
    expect(roomSave).toHaveBeenCalledWith(
      expect.objectContaining({ reconciledAt: expect.any(Date) }),
    );
  });

  it('reconcileRoom closes still-open existing rows when entry has leftAt', async () => {
    const room = makeRoom();
    partFindOne.mockResolvedValue({
      id: 'p-existing',
      leftAt: null,
      clientType: null,
    });
    getJoinLog.mockResolvedValue([
      {
        meetKey: room.meetKey,
        userId: 'u-x',
        joinedAt: '2026-06-10T09:01:00Z',
        leftAt: '2026-06-10T09:50:00Z',
        totalSeconds: 2940,
        clientType: 'web',
      },
    ]);

    const r = await svc.reconcileRoom(room);
    expect(r).toEqual({ inserted: 0, updated: 1 });
    expect(partUpdate).toHaveBeenCalledWith(
      { id: 'p-existing' },
      expect.objectContaining({
        leftAt: new Date('2026-06-10T09:50:00Z'),
        totalSeconds: 2940,
        clientType: 'web',
      }),
    );
  });

  it('reconcileRoom is no-op for entries that already have leftAt populated', async () => {
    const room = makeRoom();
    partFindOne.mockResolvedValue({
      id: 'p-existing',
      leftAt: new Date('2026-06-10T09:50:00Z'),
    });
    getJoinLog.mockResolvedValue([
      {
        meetKey: room.meetKey,
        userId: 'u-x',
        joinedAt: '2026-06-10T09:01:00Z',
        leftAt: '2026-06-10T09:50:00Z',
      },
    ]);

    const r = await svc.reconcileRoom(room);
    expect(r).toEqual({ inserted: 0, updated: 0 });
    expect(partUpdate).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // sweep — cron driver
  // ----------------------------------------------------------

  it('sweep skips rooms still within their grace window', async () => {
    // endedAt is 1 minute ago → reconcileDelayMin=10 means we wait 9 more.
    const recent = makeRoom({ endedAt: new Date(Date.now() - 60_000) });
    stageSweep(recent);

    const r = await svc.sweep();
    expect(r).toEqual({ scanned: 1, reconciled: 0, closed: 0 });
    expect(getJoinLog).not.toHaveBeenCalled();
  });

  it('sweep reconciles + auto-closes rooms past grace', async () => {
    const overdue = makeRoom({
      endedAt: new Date(Date.now() - 30 * 60_000),
    });
    stageSweep(overdue);
    partFindOne.mockResolvedValue(null);
    getJoinLog.mockResolvedValue([
      {
        meetKey: overdue.meetKey,
        userId: 'u-1',
        joinedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
        leftAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      },
    ]);

    const r = await svc.sweep();
    expect(r).toEqual({ scanned: 1, reconciled: 1, closed: 1 });
    // First save = reconciledAt set on room, second save = CLOSED transition
    const savedRooms = roomSave.mock.calls.map((c) => c[0]);
    expect(savedRooms.at(-1)).toEqual(
      expect.objectContaining({
        status: 'CLOSED',
        closeType: 'auto_reconcile',
      }),
    );
  });

  // REQ-260912B — 종료 웹훅이 유실되면 방이 PENDING 에 머물러 기존 sweep 은
  // 영원히 건너뛰었다. 예약 종료시각 기준으로 집어 SERVER API 에서 실제 시각을
  // 끌어와야 강의실 기록(입·퇴장)이 채워진다.
  it('sweep picks webhook-missed rooms and pulls room state from SERVER API', async () => {
    const evtEnd = new Date(Date.now() - 30 * 60_000);
    const stuck = makeRoom({
      status: 'PENDING',
      openedAt: null,
      startedAt: null,
      endedAt: null,
    });
    stageSweep(stuck, evtEnd);
    getMeetInfo.mockResolvedValue({
      meetKey: stuck.meetKey,
      meetIdx: 'M-9',
      status: 'ENDED',
      openedAt: '2026-06-10T09:00:00.000Z',
      startedAt: '2026-06-10T09:05:00.000Z',
      endedAt: '2026-06-10T09:55:00.000Z',
      closedAt: null,
    });
    partFindOne.mockResolvedValue(null);
    getJoinLog.mockResolvedValue([
      {
        meetKey: stuck.meetKey,
        userId: 'u-9',
        joinedAt: '2026-06-10T09:06:00.000Z',
        leftAt: '2026-06-10T09:50:00.000Z',
      },
    ]);

    const r = await svc.sweep();
    expect(getMeetInfo).toHaveBeenCalledWith(stuck.meetKey, undefined);
    expect(r).toEqual({ scanned: 1, reconciled: 1, closed: 1 });
    expect(partSave).toHaveBeenCalled();
    const saved = roomSave.mock.calls.map((c) => c[0]);
    expect(saved[0]).toEqual(
      expect.objectContaining({
        endedAt: new Date('2026-06-10T09:55:00.000Z'),
      }),
    );
  });

  it('sweep keeps reconciledAt=null when SERVER API is down', async () => {
    const overdue = makeRoom({ endedAt: new Date(Date.now() - 30 * 60_000) });
    stageSweep(overdue);
    getJoinLog.mockRejectedValueOnce(
      new BodaeduUnavailableException('timeout'),
    );

    const r = await svc.sweep();
    expect(r).toEqual({ scanned: 1, reconciled: 0, closed: 0 });
    expect(roomSave).not.toHaveBeenCalled();
  });
});
