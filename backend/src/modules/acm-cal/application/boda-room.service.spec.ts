import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ACM_DS } from '../../acm-common/datasource';
import {
  BODAEDU_SERVER_CLIENT,
  BodaeduUnavailableException,
  type IBodaeduServerClient,
} from '../../../infrastructure/external/bodaedu/interfaces/bodaedu-server-api.interface';
import { BODA_EVENT_CODES } from '../../../infrastructure/external/bodaedu/bodaedu.types';
import { BodaRoomTypeormEntity } from '../infrastructure/typeorm/boda-room.typeorm-entity';
import { BodaRoomService, makeMeetKey } from './boda-room.service';
import { BodaConfigService } from './boda-config.service';

describe('BodaRoomService', () => {
  let svc: BodaRoomService;
  let findOne: jest.Mock;
  let create: jest.Mock;
  let save: jest.Mock;
  let del: jest.Mock;
  let closeMeet: jest.Mock;
  let cfgFindByEntId: jest.Mock;
  let getServerApiAuth: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn();
    create = jest.fn((dto) => ({ id: 'new-id', ...dto }));
    save = jest.fn(async (r) => r);
    del = jest.fn().mockResolvedValue({ affected: 1 });
    closeMeet = jest.fn().mockResolvedValue(undefined);
    cfgFindByEntId = jest.fn().mockResolvedValue({
      isActive: true,
      defaultRoomCode: 'r-tpi-699',
    });
    getServerApiAuth = jest.fn().mockResolvedValue(null);

    const mod = await Test.createTestingModule({
      providers: [
        BodaRoomService,
        {
          provide: getRepositoryToken(BodaRoomTypeormEntity, ACM_DS),
          useValue: { findOne, create, save, delete: del },
        },
        {
          provide: BodaConfigService,
          useValue: {
            findByEntId: cfgFindByEntId,
            getServerApiAuth,
          } as Partial<BodaConfigService>,
        },
        {
          provide: BODAEDU_SERVER_CLIENT,
          useValue: { closeMeet } as Partial<IBodaeduServerClient>,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              k === 'FRONTEND_URL'
                ? 'https://acm.amoeba.site'
                : k === 'BODA_DEFAULT_ROOM_CODE'
                  ? 'r-env-fallback'
                  : undefined,
          },
        },
      ],
    }).compile();
    svc = mod.get(BodaRoomService);
  });

  describe('makeMeetKey', () => {
    it('formats `tac-{evtId hex 32}`', () => {
      const key = makeMeetKey('11111111-2222-3333-4444-555555555555');
      expect(key).toBe('tac-11111111222233334444555555555555');
    });

    it('rejects non-UUID', () => {
      expect(() => makeMeetKey('not-a-uuid')).toThrow();
    });
  });

  describe('createPending', () => {
    it('inserts a PENDING row + returns launcher URL', async () => {
      findOne.mockResolvedValue(null);
      const { room, launcherUrl } = await svc.createPending({
        evtId: '11111111-2222-3333-4444-555555555555',
        entId: 'e1',
      });
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          entId: 'e1',
          status: 'PENDING',
          meetKey: 'tac-11111111222233334444555555555555',
          roomCode: 'r-tpi-699',
        }),
      );
      expect(room.status).toBe('PENDING');
      expect(launcherUrl).toBe(
        'https://acm.amoeba.site/portal/classroom/11111111-2222-3333-4444-555555555555',
      );
    });

    it('idempotent — returns existing row without re-creating', async () => {
      findOne.mockResolvedValue({
        id: 'existing',
        meetKey: 'tac-aaa',
        status: 'PENDING',
      });
      await svc.createPending({
        evtId: '11111111-2222-3333-4444-555555555555',
        entId: 'e1',
      });
      expect(create).not.toHaveBeenCalled();
    });

    it('refuses when tenant config is inactive (422)', async () => {
      findOne.mockResolvedValue(null);
      cfgFindByEntId.mockResolvedValue({
        isActive: false,
        defaultRoomCode: 'r',
      });
      const err = await svc
        .createPending({
          evtId: '11111111-2222-3333-4444-555555555555',
          entId: 'e1',
        })
        .catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'BODA_DISABLED_FOR_TENANT',
      });
    });

    it('falls back to env BODA_DEFAULT_ROOM_CODE when config row missing', async () => {
      findOne.mockResolvedValue(null);
      cfgFindByEntId.mockResolvedValue(null);
      await svc.createPending({
        evtId: '11111111-2222-3333-4444-555555555555',
        entId: 'e1',
      });
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ roomCode: 'r-env-fallback' }),
      );
    });
  });

  describe('state machine — applyEvent', () => {
    const room = (
      overrides: Partial<BodaRoomTypeormEntity> = {},
    ): BodaRoomTypeormEntity =>
      ({
        id: 'r1',
        meetKey: 'tac-aaa',
        status: 'PENDING',
        ...overrides,
      }) as unknown as BodaRoomTypeormEntity;

    it('PENDING + ROOM_OPENED → OPEN + meetIdx saved', async () => {
      findOne.mockResolvedValue(room());
      const updated = await svc.applyEvent(
        'tac-aaa',
        BODA_EVENT_CODES.ROOM_OPENED,
        {
          meetIdx: 'm-123',
        },
      );
      expect(updated?.status).toBe('OPEN');
      expect(updated?.meetIdx).toBe('m-123');
    });

    it('OPEN + ROOM_STARTED → STARTED', async () => {
      findOne.mockResolvedValue(room({ status: 'OPEN', openedAt: new Date() }));
      const updated = await svc.applyEvent(
        'tac-aaa',
        BODA_EVENT_CODES.ROOM_STARTED,
        {},
      );
      expect(updated?.status).toBe('STARTED');
    });

    it('STARTED + ROOM_PAUSED → PAUSED', async () => {
      findOne.mockResolvedValue(
        room({ status: 'STARTED', startedAt: new Date() }),
      );
      const updated = await svc.applyEvent(
        'tac-aaa',
        BODA_EVENT_CODES.ROOM_PAUSED,
        {},
      );
      expect(updated?.status).toBe('PAUSED');
    });

    it('PAUSED + ROOM_STARTED → STARTED (resume)', async () => {
      findOne.mockResolvedValue(
        room({ status: 'PAUSED', startedAt: new Date() }),
      );
      const updated = await svc.applyEvent(
        'tac-aaa',
        BODA_EVENT_CODES.ROOM_STARTED,
        {},
      );
      expect(updated?.status).toBe('STARTED');
    });

    it('STARTED + ROOM_ENDED → ENDED', async () => {
      findOne.mockResolvedValue(room({ status: 'STARTED' }));
      const updated = await svc.applyEvent(
        'tac-aaa',
        BODA_EVENT_CODES.ROOM_ENDED,
        {},
      );
      expect(updated?.status).toBe('ENDED');
      expect(updated?.endedAt).toBeDefined();
    });

    it('ENDED + ROOM_CLOSED → CLOSED + closeType', async () => {
      findOne.mockResolvedValue(room({ status: 'ENDED' }));
      const updated = await svc.applyEvent(
        'tac-aaa',
        BODA_EVENT_CODES.ROOM_CLOSED,
        {
          closeType: 'normal',
        },
      );
      expect(updated?.status).toBe('CLOSED');
      expect(updated?.closeType).toBe('normal');
    });

    it('ROOM_ALL_CLOSED collapses to CLOSED from any live state', async () => {
      findOne.mockResolvedValue(room({ status: 'STARTED' }));
      const updated = await svc.applyEvent(
        'tac-aaa',
        BODA_EVENT_CODES.ROOM_ALL_CLOSED,
        {},
      );
      expect(updated?.status).toBe('CLOSED');
    });

    it('unknown meetKey → null (caller still logs payload)', async () => {
      findOne.mockResolvedValue(null);
      const updated = await svc.applyEvent(
        'tac-zzz',
        BODA_EVENT_CODES.ROOM_OPENED,
        {},
      );
      expect(updated).toBeNull();
    });

    it('non-domain event code (e.g. 13 score) → no mutation, returns row as-is', async () => {
      findOne.mockResolvedValue(room({ status: 'STARTED' }));
      const updated = await svc.applyEvent(
        'tac-aaa',
        BODA_EVENT_CODES.USER_SCORE,
        {},
      );
      expect(updated?.status).toBe('STARTED');
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('closeAndDelete', () => {
    it('calls SERVER API close + deletes when room is live', async () => {
      findOne.mockResolvedValue({
        id: 'r1',
        meetKey: 'tac-aaa',
        status: 'OPEN',
      });
      await svc.closeAndDelete('evt-1', 'e1');
      expect(closeMeet).toHaveBeenCalledWith(
        expect.objectContaining({
          meetKey: 'tac-aaa',
          reason: 'event_deleted',
        }),
        undefined,
      );
      expect(getServerApiAuth).toHaveBeenCalledWith('e1');
      expect(del).toHaveBeenCalledWith({ id: 'r1' });
    });

    it('skips SERVER API call when already closed', async () => {
      findOne.mockResolvedValue({
        id: 'r1',
        meetKey: 'tac-aaa',
        status: 'CLOSED',
      });
      await svc.closeAndDelete('evt-1', 'e1');
      expect(closeMeet).not.toHaveBeenCalled();
      expect(del).toHaveBeenCalled();
    });

    it('does NOT block deletion if SERVER API is unavailable', async () => {
      findOne.mockResolvedValue({
        id: 'r1',
        meetKey: 'tac-aaa',
        status: 'STARTED',
      });
      closeMeet.mockRejectedValue(new BodaeduUnavailableException('5xx'));
      await expect(svc.closeAndDelete('evt-1', 'e1')).resolves.toBeUndefined();
      expect(del).toHaveBeenCalled();
    });

    it('no-op when no room row exists', async () => {
      findOne.mockResolvedValue(null);
      await svc.closeAndDelete('evt-1', 'e1');
      expect(closeMeet).not.toHaveBeenCalled();
      expect(del).not.toHaveBeenCalled();
    });
  });

  describe('forceClose (admin)', () => {
    it('marks CLOSED locally even if SERVER API unavailable', async () => {
      findOne.mockResolvedValue({
        id: 'r1',
        meetKey: 'tac-aaa',
        status: 'STARTED',
      });
      closeMeet.mockRejectedValue(new BodaeduUnavailableException('timeout'));
      const result = await svc.forceClose('evt-1', 'e1', 'admin-user-1');
      expect(result.status).toBe('CLOSED');
      expect(result.closeType).toMatch(/admin_force/);
    });

    it('throws 404 when room not found', async () => {
      findOne.mockResolvedValue(null);
      const err = await svc
        .forceClose('evt-1', 'e1', 'admin-1')
        .catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });
});
