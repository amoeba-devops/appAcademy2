import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { BodaEventLogTypeormEntity } from '../infrastructure/typeorm/boda-event-log.typeorm-entity';
import { BodaParticipantTypeormEntity } from '../infrastructure/typeorm/boda-participant.typeorm-entity';
import { BodaRoomService } from './boda-room.service';
import { BodaConfigService } from './boda-config.service';
import { BodaWebhookService } from './boda-webhook.service';
import { BODA_EVENT_CODES } from '../../../infrastructure/external/bodaedu/bodaedu.types';

/**
 * Behaviors covered:
 *  1. verifyAuth: NO_AUTH_CONFIGURED when neither factor set (fail closed)
 *  2. verifyAuth: INVALID_TOKEN when a token is sent but mismatches
 *  3. verifyAuth: NOT_IN_ALLOWLIST when IP outside CIDR (hard gate)
 *  4. verifyAuth: ok when token + IP pass; ok with no token when IP allowlisted
 *     (FIX-260624 — BODA sends no webhook token); MISSING_TOKEN when secret-only
 *  5. handle: persists log row + calls applyEvent + marks processed
 *  6. handle: returns {deduped:true} on PG UNIQUE 23505
 *  7. handle: USER_JOINED → participant insert + closes any open prior row
 *  8. handle: USER_LEFT → updates open row with leftAt + totalSeconds
 *  9. handle: USER_LEFT without prior join → records leave-only row (T6-05)
 * 10. handle: domain error doesn't rethrow — audit row stays, error column populated
 */
describe('BodaWebhookService', () => {
  let svc: BodaWebhookService;

  // log repo mocks
  let logSave: jest.Mock;
  let logCreate: jest.Mock;
  let logUpdate: jest.Mock;

  // participant repo mocks
  let partFindOne: jest.Mock;
  let partSave: jest.Mock;
  let partCreate: jest.Mock;
  let partUpdate: jest.Mock;

  // room service mocks
  let applyEvent: jest.Mock;
  let findByMeetKey: jest.Mock;

  // config service mocks
  let getDecryptedEventSecret: jest.Mock;
  let findByEntId: jest.Mock;

  beforeEach(async () => {
    logSave = jest.fn(async (r) => r);
    logCreate = jest.fn((dto) => ({ id: 'log-1', ...dto }));
    logUpdate = jest.fn().mockResolvedValue({ affected: 1 });

    partFindOne = jest.fn();
    partSave = jest.fn(async (r) => r);
    partCreate = jest.fn((dto) => ({ id: 'p-1', ...dto }));
    partUpdate = jest.fn().mockResolvedValue({ affected: 1 });

    applyEvent = jest.fn().mockResolvedValue(null);
    findByMeetKey = jest.fn();

    getDecryptedEventSecret = jest.fn();
    findByEntId = jest.fn();

    const mod = await Test.createTestingModule({
      providers: [
        BodaWebhookService,
        {
          provide: getRepositoryToken(BodaEventLogTypeormEntity, ACM_DS),
          useValue: { save: logSave, create: logCreate, update: logUpdate },
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
          provide: BodaRoomService,
          useValue: {
            applyEvent,
            findByMeetKey,
          } as Partial<BodaRoomService>,
        },
        {
          provide: BodaConfigService,
          useValue: {
            getDecryptedEventSecret,
            findByEntId,
          } as Partial<BodaConfigService>,
        },
      ],
    }).compile();

    svc = mod.get(BodaWebhookService);
  });

  // -----------------------------------------------------------------
  // verifyAuth
  // -----------------------------------------------------------------

  describe('verifyAuth', () => {
    it('returns NO_AUTH_CONFIGURED when neither secret nor allowlist set', async () => {
      getDecryptedEventSecret.mockResolvedValue(null);
      findByEntId.mockResolvedValue({ webhookAllowCidrs: null });
      const r = await svc.verifyAuth('ent-1', 'whatever', '1.2.3.4');
      expect(r).toEqual({ ok: false, reason: 'NO_AUTH_CONFIGURED' });
    });

    it('returns INVALID_TOKEN when a token is sent but mismatches', async () => {
      getDecryptedEventSecret.mockResolvedValue('secret-abc');
      findByEntId.mockResolvedValue({ webhookAllowCidrs: '1.2.3.0/24' });
      const r = await svc.verifyAuth('ent-1', 'wrong-token', '1.2.3.4');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('INVALID_TOKEN');
    });

    it('returns NOT_IN_ALLOWLIST when IP outside CIDR (IP is a hard gate)', async () => {
      getDecryptedEventSecret.mockResolvedValue('secret-abc');
      findByEntId.mockResolvedValue({ webhookAllowCidrs: '10.0.0.0/8' });
      const r = await svc.verifyAuth('ent-1', 'secret-abc', '1.2.3.4');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('NOT_IN_ALLOWLIST');
    });

    it('returns ok when token + IP both pass', async () => {
      getDecryptedEventSecret.mockResolvedValue('secret-abc');
      findByEntId.mockResolvedValue({ webhookAllowCidrs: '1.2.3.0/24' });
      const r = await svc.verifyAuth('ent-1', 'secret-abc', '1.2.3.99');
      expect(r).toEqual({ ok: true });
    });

    // FIX-260624 — BODA sends events without a token; IP allowlist authenticates.
    it('returns ok with NO token when IP is allowlisted (secret unset)', async () => {
      getDecryptedEventSecret.mockResolvedValue(null);
      findByEntId.mockResolvedValue({ webhookAllowCidrs: '1.2.3.0/24' });
      const r = await svc.verifyAuth('ent-1', undefined, '1.2.3.99');
      expect(r).toEqual({ ok: true });
    });

    it('returns ok with NO token when IP allowlisted even if a secret is set', async () => {
      getDecryptedEventSecret.mockResolvedValue('secret-abc');
      findByEntId.mockResolvedValue({ webhookAllowCidrs: '1.2.3.0/24' });
      const r = await svc.verifyAuth('ent-1', undefined, '1.2.3.99');
      expect(r).toEqual({ ok: true });
    });

    it('returns MISSING_TOKEN when secret is the only factor and no token sent', async () => {
      getDecryptedEventSecret.mockResolvedValue('secret-abc');
      findByEntId.mockResolvedValue({ webhookAllowCidrs: null });
      const r = await svc.verifyAuth('ent-1', undefined, '1.2.3.4');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('MISSING_TOKEN');
    });
  });

  // -----------------------------------------------------------------
  // handle — happy path & dedup
  // -----------------------------------------------------------------

  it('persists audit row + dispatches applyEvent + marks processed', async () => {
    const at = new Date('2026-06-10T10:00:00Z');
    findByMeetKey.mockResolvedValue({ id: 'room-1' });

    const r = await svc.handle({
      entId: 'ent-1',
      eventCode: BODA_EVENT_CODES.ROOM_STARTED,
      meetIdx: 'M-001',
      meetKey: 'tac-ffff',
      eventAt: at,
      userId: null,
      payload: { foo: 'bar' },
      srcIp: '1.2.3.4',
    });

    expect(r).toEqual({ deduped: false });
    expect(logSave).toHaveBeenCalledTimes(1);
    expect(applyEvent).toHaveBeenCalledWith(
      'tac-ffff',
      BODA_EVENT_CODES.ROOM_STARTED,
      expect.objectContaining({ meetIdx: 'M-001', eventAt: at }),
    );
    // marks processed=true at the end
    expect(logUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        entId: 'ent-1',
        eventCode: BODA_EVENT_CODES.ROOM_STARTED,
        eventAt: at,
      }),
      expect.objectContaining({ processed: true }),
    );
  });

  it('returns {deduped:true} on PG 23505 unique violation, no domain mutation', async () => {
    const dup = new QueryFailedError('insert', [], new Error('dup'));
    (dup as unknown as { driverError: { code: string } }).driverError = {
      code: '23505',
    };
    logSave.mockRejectedValueOnce(dup);

    const r = await svc.handle({
      entId: 'ent-1',
      eventCode: 2,
      meetIdx: 'M-001',
      meetKey: 'tac-ffff',
      eventAt: new Date(),
      userId: null,
      payload: {},
      srcIp: null,
    });

    expect(r).toEqual({ deduped: true });
    expect(applyEvent).not.toHaveBeenCalled();
  });

  it('rethrows non-unique DB errors so caller returns 5xx and BODA retries', async () => {
    const other = new QueryFailedError('insert', [], new Error('boom'));
    (other as unknown as { driverError: { code: string } }).driverError = {
      code: '42P01',
    };
    logSave.mockRejectedValueOnce(other);

    await expect(
      svc.handle({
        entId: 'ent-1',
        eventCode: 2,
        meetIdx: null,
        meetKey: null,
        eventAt: new Date(),
        userId: null,
        payload: {},
        srcIp: null,
      }),
    ).rejects.toBeDefined();
  });

  // -----------------------------------------------------------------
  // Participant — JOIN/LEAVE
  // -----------------------------------------------------------------

  it('USER_JOINED inserts a new participant row + closes any prior open row', async () => {
    const at = new Date('2026-06-10T10:05:00Z');
    findByMeetKey.mockResolvedValue({ id: 'room-1' });
    partFindOne.mockResolvedValue({
      id: 'p-prev',
      joinedAt: new Date('2026-06-10T10:00:00Z'),
    });

    await svc.handle({
      entId: 'ent-1',
      eventCode: BODA_EVENT_CODES.USER_JOINED,
      meetIdx: 'M-1',
      meetKey: 'tac-aaa',
      eventAt: at,
      userId: 'u-bodauid-1',
      payload: { UTy: 12 },
      srcIp: null,
    });

    // Prior open row gets closed
    expect(partUpdate).toHaveBeenCalledWith(
      { id: 'p-prev' },
      expect.objectContaining({ leftAt: at, totalSeconds: 300 }),
    );
    // New row inserted with userKind=STUDENT (UTy=12) and leftAt=null
    expect(partSave).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-1',
        bodaUserId: 'u-bodauid-1',
        userKind: 'STUDENT',
        leftAt: null,
        totalSeconds: null,
      }),
    );
  });

  it('USER_LEFT updates the open row with leftAt + totalSeconds', async () => {
    const joinedAt = new Date('2026-06-10T10:00:00Z');
    const leftAt = new Date('2026-06-10T10:30:00Z');
    findByMeetKey.mockResolvedValue({ id: 'room-1' });
    partFindOne.mockResolvedValue({ id: 'p-open', joinedAt });

    await svc.handle({
      entId: 'ent-1',
      eventCode: BODA_EVENT_CODES.USER_LEFT,
      meetIdx: 'M-1',
      meetKey: 'tac-aaa',
      eventAt: leftAt,
      userId: 'u-1',
      payload: {},
      srcIp: null,
    });

    expect(partUpdate).toHaveBeenCalledWith(
      { id: 'p-open' },
      { leftAt, totalSeconds: 1800 },
    );
  });

  it('USER_LEFT with no prior join records leave-only row (T6-05 out-of-order)', async () => {
    findByMeetKey.mockResolvedValue({ id: 'room-1' });
    partFindOne.mockResolvedValue(null); // no open row

    const at = new Date('2026-06-10T10:30:00Z');
    await svc.handle({
      entId: 'ent-1',
      eventCode: BODA_EVENT_CODES.USER_LEFT,
      meetIdx: 'M-1',
      meetKey: 'tac-aaa',
      eventAt: at,
      userId: 'orphan-uid',
      payload: {},
      srcIp: null,
    });

    expect(partSave).toHaveBeenCalledWith(
      expect.objectContaining({
        bodaUserId: 'orphan-uid',
        joinedAt: at,
        leftAt: at,
        totalSeconds: 0,
      }),
    );
  });

  it('audit row stays + error column written when domain mutation throws', async () => {
    findByMeetKey.mockResolvedValue({ id: 'room-1' });
    applyEvent.mockRejectedValueOnce(new Error('boom from room.applyEvent'));

    const at = new Date('2026-06-10T10:00:00Z');
    const r = await svc.handle({
      entId: 'ent-1',
      eventCode: 2,
      meetIdx: 'M-1',
      meetKey: 'tac-aaa',
      eventAt: at,
      userId: null,
      payload: {},
      srcIp: null,
    });

    expect(r).toEqual({ deduped: false });
    expect(logSave).toHaveBeenCalled();
    // last logUpdate writes the error message
    expect(logUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ error: expect.stringContaining('boom') }),
    );
  });
});
