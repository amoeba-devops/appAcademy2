import { Readable } from 'stream';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ObjectStoreClient } from '../../acm-csl/infrastructure/external/object-store.client';
import {
  BODAEDU_SERVER_CLIENT,
  type IBodaeduServerClient,
} from '../../../infrastructure/external/bodaedu/interfaces/bodaedu-server-api.interface';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import { BodaRoomTypeormEntity } from '../infrastructure/typeorm/boda-room.typeorm-entity';
import { BodaRecordingTypeormEntity } from '../infrastructure/typeorm/boda-recording.typeorm-entity';
import { BodaConfigService } from './boda-config.service';
import { BodaRecordingService } from './boda-recording.service';

/**
 * REQ-260912B — 커버 범위
 *  1. 접근 제어: ADMIN/STAFF 통과, 무관한 TEACHER 403, 그 외 role 403
 *  2. 상태 판정: 종료 + 녹화 0 → AWAITING → NO_RECORDING, 녹화 있으면 AVAILABLE
 *  3. syncEvent: 보다 목록을 upsert (fileExist=false → MISSING)
 *  4. archiveDue: 스트림 업로드 후 ARCHIVED, 실패 시 FAILED
 *  5. openStream: 보관본 우선(S3 Range), 없으면 보다 프록시 폴백
 */
describe('BodaRecordingService', () => {
  let svc: BodaRecordingService;
  let mod: Awaited<
    ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>
  >;
  let recFind: jest.Mock;
  let recFindOne: jest.Mock;
  let recSave: jest.Mock;
  let recUpdate: jest.Mock;
  let recQuery: jest.Mock;
  let roomFindOne: jest.Mock;
  let evtFindOne: jest.Mock;
  let listRecordings: jest.Mock;
  let downloadRecording: jest.Mock;
  let putObjectStream: jest.Mock;
  let getObjectStream: jest.Mock;

  const HOUR = 3600_000;
  const event = (over: Partial<CalEventTypeormEntity> = {}) =>
    ({
      id: 'e-1',
      entId: 'ent-1',
      meetingProvider: 'BODASCHOOL',
      startAt: new Date(Date.now() - 3 * HOUR),
      endAt: new Date(Date.now() - 2 * HOUR),
      ...over,
    }) as CalEventTypeormEntity;

  const room = (over: Partial<BodaRoomTypeormEntity> = {}) =>
    ({
      id: 'r-1',
      entId: 'ent-1',
      evtId: 'e-1',
      meetKey: 'tac-aaa',
      roomCode: '699',
      meetIdx: 'M-1',
      status: 'ENDED',
      ...over,
    }) as BodaRoomTypeormEntity;

  const rec = (over: Partial<BodaRecordingTypeormEntity> = {}) =>
    ({
      id: 'v-1',
      entId: 'ent-1',
      evtId: 'e-1',
      roomId: 'r-1',
      recordIdx: 11,
      title: '1차시',
      fileExist: true,
      archiveStatus: 'PENDING',
      attempts: 0,
      s3Key: null,
      sizeBytes: null,
      startedAt: null,
      endedAt: null,
      durationSec: null,
      mime: null,
      ...over,
    }) as BodaRecordingTypeormEntity;

  beforeEach(async () => {
    recFind = jest.fn().mockResolvedValue([]);
    recFindOne = jest.fn().mockResolvedValue(null);
    recSave = jest.fn(async (r) => r);
    recUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    recQuery = jest.fn().mockResolvedValue([]);
    roomFindOne = jest.fn().mockResolvedValue(null);
    evtFindOne = jest.fn().mockResolvedValue(event());
    listRecordings = jest.fn().mockResolvedValue([]);
    downloadRecording = jest.fn();
    putObjectStream = jest.fn().mockResolvedValue(undefined);
    getObjectStream = jest.fn();

    mod = await Test.createTestingModule({
      providers: [
        BodaRecordingService,
        {
          provide: getRepositoryToken(BodaRecordingTypeormEntity, ACM_DS),
          useValue: {
            find: recFind,
            findOne: recFindOne,
            save: recSave,
            update: recUpdate,
            query: recQuery,
            create: (dto: unknown) => dto,
          },
        },
        {
          provide: getRepositoryToken(BodaRoomTypeormEntity, ACM_DS),
          useValue: { findOne: roomFindOne },
        },
        {
          provide: getRepositoryToken(CalEventTypeormEntity, ACM_DS),
          useValue: { findOne: evtFindOne },
        },
        {
          provide: BODAEDU_SERVER_CLIENT,
          useValue: {
            listRecordings,
            downloadRecording,
          } as Partial<IBodaeduServerClient>,
        },
        {
          provide: BodaConfigService,
          useValue: {
            getServerApiAuth: jest.fn().mockResolvedValue(null),
          } as Partial<BodaConfigService>,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('tkt'),
            verify: jest.fn(),
          },
        },
        {
          provide: ObjectStoreClient,
          useValue: {
            isConfigured: () => true,
            putObject: jest.fn(),
            putObjectStream,
            getObjectStream,
          } as Partial<ObjectStoreClient>,
        },
      ],
    }).compile();
    svc = mod.get(BodaRecordingService);
  });

  // ── 접근 제어 ───────────────────────────────────────────────────────

  it('ADMIN/STAFF pass access check; unrelated TEACHER is rejected', async () => {
    await expect(
      svc.assertConsoleAccess('ent-1', 'e-1', { id: 'u-1', role: 'ADMIN' }),
    ).resolves.toBeUndefined();
    await expect(
      svc.assertConsoleAccess('ent-1', 'e-1', { id: 'u-1', role: 'STAFF' }),
    ).resolves.toBeUndefined();

    recQuery.mockResolvedValue([]); // 강사가 이 수업과 무관
    await expect(
      svc.assertConsoleAccess('ent-1', 'e-1', { id: 'u-9', role: 'TEACHER' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('related TEACHER passes; portal-only roles are rejected outright', async () => {
    recQuery.mockResolvedValue([{ ok: 1 }]);
    await expect(
      svc.assertConsoleAccess('ent-1', 'e-1', { id: 'u-2', role: 'TEACHER' }),
    ).resolves.toBeUndefined();

    await expect(
      svc.assertConsoleAccess('ent-1', 'e-1', { id: 'p-1', role: 'PARENT' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ── 상태 판정 ───────────────────────────────────────────────────────

  it('derives AWAITING right after the class and NO_RECORDING later', async () => {
    roomFindOne.mockResolvedValue(room());

    evtFindOne.mockResolvedValue(
      event({ endAt: new Date(Date.now() - 5 * 60_000) }),
    );
    expect((await svc.summaryForEvent('ent-1', 'e-1')).status).toBe('AWAITING');

    evtFindOne.mockResolvedValue(event()); // 2시간 전 종료
    expect((await svc.summaryForEvent('ent-1', 'e-1')).status).toBe(
      'NO_RECORDING',
    );
  });

  it('reports IN_PROGRESS while the room is live and NOT_APPLICABLE off BODA', async () => {
    roomFindOne.mockResolvedValue(room({ status: 'STARTED' }));
    expect((await svc.summaryForEvent('ent-1', 'e-1')).status).toBe(
      'IN_PROGRESS',
    );

    evtFindOne.mockResolvedValue(event({ meetingProvider: 'NONE' }));
    expect((await svc.summaryForEvent('ent-1', 'e-1')).status).toBe(
      'NOT_APPLICABLE',
    );
  });

  it('reports AVAILABLE with archive counters once rows exist', async () => {
    roomFindOne.mockResolvedValue(room());
    recFind.mockResolvedValue([
      rec({ archiveStatus: 'ARCHIVED', sizeBytes: '1024' }),
      rec({ id: 'v-2', recordIdx: 12, archiveStatus: 'FAILED' }),
    ]);

    const s = await svc.summaryForEvent('ent-1', 'e-1');
    expect(s.status).toBe('AVAILABLE');
    expect(s.counts).toEqual({
      total: 2,
      archived: 1,
      pending: 0,
      failed: 1,
    });
  });

  // ── 동기화 ─────────────────────────────────────────────────────────

  it('syncEvent upserts vendor rows and marks file-less ones MISSING', async () => {
    roomFindOne.mockResolvedValue(room());
    listRecordings.mockResolvedValue([
      {
        recordIdx: 11,
        recordTitle: '1차시',
        startDatetime: '20260831190300',
        endDatetime: '20260831205800',
        fileExist: true,
      },
      {
        recordIdx: 12,
        recordTitle: '2차시',
        startDatetime: null,
        endDatetime: null,
        fileExist: false,
      },
    ]);

    await svc.syncEvent('ent-1', 'e-1');

    expect(listRecordings).toHaveBeenCalledWith('tac-aaa', undefined);
    const saved = recSave.mock.calls.map((c) => c[0]);
    expect(saved[0]).toEqual(
      expect.objectContaining({ recordIdx: 11, archiveStatus: 'PENDING' }),
    );
    // KST 문자열이 UTC 로 정규화되어야 한다 (19:03 KST → 10:03 UTC).
    expect((saved[0] as { startedAt: Date }).startedAt.toISOString()).toBe(
      '2026-08-31T10:03:00.000Z',
    );
    expect(saved[1]).toEqual(
      expect.objectContaining({ recordIdx: 12, archiveStatus: 'MISSING' }),
    );
  });

  it('syncEvent is a no-op against the vendor when the room has no meetKey', async () => {
    roomFindOne.mockResolvedValue(null);
    await svc.syncEvent('ent-1', 'e-1');
    expect(listRecordings).not.toHaveBeenCalled();
  });

  // ── 보관 ───────────────────────────────────────────────────────────

  it('archiveDue streams the file into the object store and marks ARCHIVED', async () => {
    recFind.mockResolvedValue([rec()]);
    downloadRecording.mockResolvedValue({
      stream: Readable.from([Buffer.from('video')]),
      contentType: 'video/mp4',
      contentLength: 5,
      contentRange: null,
      partial: false,
    });

    const r = await svc.archiveDue();

    expect(r).toEqual({ picked: 1, archived: 1, failed: 0 });
    expect(putObjectStream).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'cal-recordings/ent-1/e-1/11.mp4',
        contentLength: 5,
        mime: 'video/mp4',
      }),
    );
    expect(recUpdate).toHaveBeenLastCalledWith(
      { id: 'v-1' },
      expect.objectContaining({
        archiveStatus: 'ARCHIVED',
        s3Key: 'cal-recordings/ent-1/e-1/11.mp4',
        sizeBytes: '5',
      }),
    );
  });

  it('archiveDue marks FAILED when the vendor download blows up', async () => {
    recFind.mockResolvedValue([rec()]);
    downloadRecording.mockRejectedValue(
      new Error('RECORDING_DOWNLOAD_FAILED_500'),
    );

    const r = await svc.archiveDue();

    expect(r).toEqual({ picked: 1, archived: 0, failed: 1 });
    expect(recUpdate).toHaveBeenLastCalledWith(
      { id: 'v-1' },
      expect.objectContaining({ archiveStatus: 'FAILED' }),
    );
  });

  it('archiveDue skips rows that exhausted their retries', async () => {
    recFind.mockResolvedValue([rec({ attempts: 3, archiveStatus: 'FAILED' })]);
    const r = await svc.archiveDue();
    expect(r).toEqual({ picked: 0, archived: 0, failed: 0 });
    expect(downloadRecording).not.toHaveBeenCalled();
  });

  // ── 서빙 ───────────────────────────────────────────────────────────

  it('openStream serves the ACM archive with Range when available', async () => {
    recFindOne.mockResolvedValue(
      rec({ archiveStatus: 'ARCHIVED', s3Key: 'k/1.mp4', mime: 'video/mp4' }),
    );
    getObjectStream.mockResolvedValue({
      stream: Readable.from([Buffer.from('x')]),
      mime: 'video/mp4',
      contentLength: 1,
      contentRange: 'bytes 0-0/100',
      partial: true,
    });

    const out = await svc.openStream('ent-1', 'e-1', 11, 'bytes=0-0');

    expect(getObjectStream).toHaveBeenCalledWith('k/1.mp4', 'bytes=0-0');
    expect(out.source).toBe('ACM');
    expect(out.partial).toBe(true);
    expect(downloadRecording).not.toHaveBeenCalled();
  });

  it('openStream falls back to the BODA proxy until the archive exists', async () => {
    recFindOne.mockResolvedValue(rec());
    downloadRecording.mockResolvedValue({
      stream: Readable.from([Buffer.from('x')]),
      contentType: 'video/mp4',
      contentLength: 1,
      contentRange: null,
      partial: false,
    });

    const out = await svc.openStream('ent-1', 'e-1', 11);
    expect(out.source).toBe('BODA');
    expect(getObjectStream).not.toHaveBeenCalled();
  });

  // ── 재생 티켓 ──────────────────────────────────────────────────────

  it('rejects forged / foreign tickets', () => {
    const jwt = mod.get(JwtService) as unknown as { verify: jest.Mock };
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    expect(() => svc.verifyTicket('bad')).toThrow(ForbiddenException);

    jwt.verify.mockReturnValue({
      purpose: 'acm-session', // 세션 토큰을 재생 티켓으로 쓸 수 없어야 한다
      entId: 'ent-1',
      evtId: 'e-1',
      recordIdx: 11,
    });
    expect(() => svc.verifyTicket('session-token')).toThrow(ForbiddenException);
  });

  it('round-trips a valid ticket back into its claims', () => {
    const jwt = mod.get(JwtService) as unknown as { verify: jest.Mock };
    jwt.verify.mockReturnValue({
      purpose: 'cal-recording',
      entId: 'ent-1',
      evtId: 'e-1',
      recordIdx: 11,
    });
    expect(svc.verifyTicket('tkt')).toEqual({
      entId: 'ent-1',
      evtId: 'e-1',
      recordIdx: 11,
    });
  });

  it('openStream 404s for an unknown recordIdx', async () => {
    recFindOne.mockResolvedValue(null);
    await expect(svc.openStream('ent-1', 'e-1', 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
