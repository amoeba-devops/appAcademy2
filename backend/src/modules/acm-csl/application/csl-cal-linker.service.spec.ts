import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { CalEventService } from '../../acm-cal/application/cal-event.service';
import { TenantSettingsService } from '../../acm-system/application/tenant-settings.service';
import { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { MapTestTypeormEntity } from '../infrastructure/typeorm/map-test.typeorm-entity';
import { TrialClassTypeormEntity } from '../infrastructure/typeorm/trial-class.typeorm-entity';
import { CslCalLinkerService } from './csl-cal-linker.service';

/**
 * REQ-260626 T-08 / REQ-260903F — CSL→CAL linkage.
 * 시각은 테넌트 TZ(Asia/Seoul) 벽시계 → UTC instant 로 변환된다.
 * 이미 연동된 행은 skip 이 아니라 이벤트 시각을 update(동기화)하고,
 * 연동 이벤트가 삭제된 경우 id 를 비우고 재생성한다.
 */
describe('CslCalLinkerService', () => {
  let svc: CslCalLinkerService;
  let calCreate: jest.Mock;
  let calUpdate: jest.Mock;
  let mtUpdate: jest.Mock;
  let tclUpdate: jest.Mock;
  let decrypt: jest.Mock;

  function makeInq(): InquiryTypeormEntity {
    return {
      id: 'inq-1',
      entId: 'e1',
      isAnonymous: false,
      nameEncrypted: Buffer.from('c'),
      nameIv: Buffer.from('i'),
      nameAuthTag: Buffer.from('t'),
    } as unknown as InquiryTypeormEntity;
  }
  function makeMt(over: Partial<MapTestTypeormEntity> = {}): MapTestTypeormEntity {
    return {
      id: 'mt-1',
      entId: 'e1',
      inqId: 'inq-1',
      testType: 'MAP',
      scheduledAt: '2026-07-03',
      scheduledTime: '14:00:00',
      calEventId: null,
      ...over,
    } as MapTestTypeormEntity;
  }
  function makeTcl(over: Partial<TrialClassTypeormEntity> = {}): TrialClassTypeormEntity {
    return {
      id: 'tcl-1',
      entId: 'e1',
      inqId: 'inq-1',
      heldAt: '2026-07-08',
      heldTime: '16:30:00',
      calEventId: null,
      ...over,
    } as TrialClassTypeormEntity;
  }

  beforeEach(async () => {
    calCreate = jest.fn().mockResolvedValue({ id: 'evt-new' });
    calUpdate = jest.fn().mockResolvedValue({ id: 'existing' });
    mtUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    tclUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    decrypt = jest.fn().mockReturnValue('홍길동');

    const mod = await Test.createTestingModule({
      providers: [
        CslCalLinkerService,
        { provide: CalEventService, useValue: { create: calCreate, update: calUpdate } },
        {
          provide: TenantSettingsService,
          useValue: { getTimezone: jest.fn().mockResolvedValue('Asia/Seoul') },
        },
        { provide: AesGcmService, useValue: { decrypt } },
        { provide: getRepositoryToken(MapTestTypeormEntity, ACM_DS), useValue: { update: mtUpdate } },
        { provide: getRepositoryToken(TrialClassTypeormEntity, ACM_DS), useValue: { update: tclUpdate } },
      ],
    }).compile();
    svc = mod.get(CslCalLinkerService);
  });

  // ── linkLevelTest ──────────────────────────────────────────────────

  it('REQ-260903F: already linked → updates event times (sync, not skip)', async () => {
    const r = await svc.linkLevelTest(
      makeInq(),
      makeMt({ calEventId: 'existing' }),
      'u1',
      'STAFF',
    );
    expect(r).toBe('existing');
    expect(calCreate).not.toHaveBeenCalled();
    expect(calUpdate).toHaveBeenCalledWith(
      'e1',
      'u1',
      'STAFF',
      'existing',
      expect.objectContaining({
        evtStartAt: '2026-07-03T05:00:00.000Z', // 14:00 KST
        evtEndAt: '2026-07-03T06:00:00.000Z',
        evtEditReason: expect.any(String),
      }),
    );
  });

  it('REQ-260903F: linked event deleted → clears id and recreates', async () => {
    calUpdate.mockRejectedValueOnce(new NotFoundException('EVENT_NOT_FOUND'));
    const r = await svc.linkLevelTest(
      makeInq(),
      makeMt({ calEventId: 'gone' }),
      'u1',
      'STAFF',
    );
    expect(r).toBe('evt-new');
    expect(mtUpdate).toHaveBeenCalledWith({ id: 'mt-1' }, { calEventId: null });
    expect(calCreate).toHaveBeenCalled();
    expect(mtUpdate).toHaveBeenCalledWith({ id: 'mt-1' }, { calEventId: 'evt-new' });
  });

  it('skips when scheduledAt missing', async () => {
    const r = await svc.linkLevelTest(
      makeInq(),
      makeMt({ scheduledAt: null }),
      'u1',
      'STAFF',
    );
    expect(r).toBeNull();
  });

  it('skips when scheduledTime missing', async () => {
    const r = await svc.linkLevelTest(
      makeInq(),
      makeMt({ scheduledTime: null }),
      'u1',
      'STAFF',
    );
    expect(r).toBeNull();
  });

  it('happy path — creates LEVEL_TEST event in UTC (KST wall clock), stores id back on mpt', async () => {
    const r = await svc.linkLevelTest(makeInq(), makeMt(), 'u1', 'STAFF');
    expect(r).toBe('evt-new');
    expect(calCreate).toHaveBeenCalledWith(
      'e1',
      'u1',
      'STAFF',
      expect.objectContaining({
        evtTitle: expect.stringContaining('홍길동'),
        evtStartAt: '2026-07-03T05:00:00.000Z', // 14:00 KST
        evtEndAt: '2026-07-03T06:00:00.000Z',
        evtCategory: 'LEVEL_TEST',
        evtMeetingProvider: 'NONE',
      }),
    );
    expect(mtUpdate).toHaveBeenCalledWith({ id: 'mt-1' }, { calEventId: 'evt-new' });
  });

  it('cal create failure → returns null, no rethrow', async () => {
    calCreate.mockRejectedValueOnce(new Error('cal down'));
    const r = await svc.linkLevelTest(makeInq(), makeMt(), 'u1', 'STAFF');
    expect(r).toBeNull();
    expect(mtUpdate).not.toHaveBeenCalled();
  });

  // ── linkDemoClass ──────────────────────────────────────────────────

  it('demo class happy path — stores id back on tcl (UTC instants)', async () => {
    const r = await svc.linkDemoClass(makeInq(), makeTcl(), 'u1', 'STAFF');
    expect(r).toBe('evt-new');
    expect(calCreate).toHaveBeenCalledWith(
      'e1',
      'u1',
      'STAFF',
      expect.objectContaining({
        evtTitle: expect.stringContaining('Demo Class'),
        evtStartAt: '2026-07-08T07:30:00.000Z', // 16:30 KST
        evtEndAt: '2026-07-08T08:30:00.000Z',
      }),
    );
    expect(tclUpdate).toHaveBeenCalledWith({ id: 'tcl-1' }, { calEventId: 'evt-new' });
  });

  it('anonymous inquiry — name skipped, "학생" placeholder used', async () => {
    const inq = makeInq();
    (inq as { isAnonymous: boolean }).isAnonymous = true;
    await svc.linkDemoClass(inq, makeTcl(), 'u1', 'STAFF');
    expect(decrypt).not.toHaveBeenCalled();
    expect(calCreate).toHaveBeenCalledWith(
      'e1',
      'u1',
      'STAFF',
      expect.objectContaining({ evtTitle: expect.stringContaining('학생') }),
    );
  });

  // ── REQ-260630 — 담당자 (teacher assignee) propagation ────────────────

  it('REQ-260630: propagates mt.teacherId → evtAssigneeTchId on level test', async () => {
    await svc.linkLevelTest(
      makeInq(),
      makeMt({ teacherId: 'tch-7' }),
      'u1',
      'STAFF',
    );
    expect(calCreate).toHaveBeenCalledWith(
      'e1',
      'u1',
      'STAFF',
      expect.objectContaining({ evtAssigneeTchId: 'tch-7' }),
    );
  });

  it('REQ-260630: omits evtAssigneeTchId when mt.teacherId is null', async () => {
    await svc.linkLevelTest(
      makeInq(),
      makeMt({ teacherId: null }),
      'u1',
      'STAFF',
    );
    const arg = calCreate.mock.calls[0][3] as Record<string, unknown>;
    expect(arg.evtAssigneeTchId).toBeUndefined();
  });

  it('REQ-260630: propagates tcl.teacherId → evtAssigneeTchId on demo class', async () => {
    await svc.linkDemoClass(
      makeInq(),
      makeTcl({ teacherId: 'tch-3' }),
      'u1',
      'STAFF',
    );
    expect(calCreate).toHaveBeenCalledWith(
      'e1',
      'u1',
      'STAFF',
      expect.objectContaining({ evtAssigneeTchId: 'tch-3' }),
    );
  });

  it('hour rollover across KST midnight — UTC instants stay consistent', async () => {
    await svc.linkLevelTest(
      makeInq(),
      makeMt({ scheduledAt: '2026-07-03', scheduledTime: '23:30:00' }),
      'u1',
      'STAFF',
    );
    expect(calCreate).toHaveBeenCalledWith(
      'e1',
      'u1',
      'STAFF',
      expect.objectContaining({
        evtStartAt: '2026-07-03T14:30:00.000Z', // 23:30 KST
        evtEndAt: '2026-07-03T15:30:00.000Z', // 00:30 KST 익일
      }),
    );
  });
});
