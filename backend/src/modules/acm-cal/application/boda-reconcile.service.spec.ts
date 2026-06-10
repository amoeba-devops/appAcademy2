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
  let roomFind: jest.Mock;
  let roomSave: jest.Mock;
  let partFindOne: jest.Mock;
  let partSave: jest.Mock;
  let partCreate: jest.Mock;
  let partUpdate: jest.Mock;
  let cfgFindByEntId: jest.Mock;
  let getJoinLog: jest.Mock;

  const makeRoom = (overrides: Partial<BodaRoomTypeormEntity> = {}): BodaRoomTypeormEntity => ({
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
  } as BodaRoomTypeormEntity);

  beforeEach(async () => {
    roomFind = jest.fn();
    roomSave = jest.fn(async (r) => r);
    partFindOne = jest.fn();
    partSave = jest.fn(async (r) => r);
    partCreate = jest.fn((dto) => ({ id: 'p-new', ...dto }));
    partUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    cfgFindByEntId = jest.fn().mockResolvedValue({ reconcileDelayMin: 10 });
    getJoinLog = jest.fn();

    const mod = await Test.createTestingModule({
      providers: [
        BodaReconcileService,
        {
          provide: getRepositoryToken(BodaRoomTypeormEntity, ACM_DS),
          useValue: { find: roomFind, save: roomSave },
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
          useValue: { findByEntId: cfgFindByEntId } as Partial<BodaConfigService>,
        },
        {
          provide: BODAEDU_SERVER_CLIENT,
          useValue: { getJoinLog } as Partial<IBodaeduServerClient>,
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
    roomFind.mockResolvedValue([recent]);

    const r = await svc.sweep();
    expect(r).toEqual({ scanned: 1, reconciled: 0, closed: 0 });
    expect(getJoinLog).not.toHaveBeenCalled();
  });

  it('sweep reconciles + auto-closes rooms past grace', async () => {
    const overdue = makeRoom({
      endedAt: new Date(Date.now() - 30 * 60_000),
    });
    roomFind.mockResolvedValue([overdue]);
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

  it('sweep keeps reconciledAt=null when SERVER API is down', async () => {
    const overdue = makeRoom({ endedAt: new Date(Date.now() - 30 * 60_000) });
    roomFind.mockResolvedValue([overdue]);
    getJoinLog.mockRejectedValueOnce(
      new BodaeduUnavailableException('timeout'),
    );

    const r = await svc.sweep();
    expect(r).toEqual({ scanned: 1, reconciled: 0, closed: 0 });
    expect(roomSave).not.toHaveBeenCalled();
  });
});
