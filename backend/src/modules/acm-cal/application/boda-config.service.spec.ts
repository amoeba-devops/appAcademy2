import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ACM_DS } from '../../acm-common/datasource';
import { BodaConfigTypeormEntity } from '../infrastructure/typeorm/boda-config.typeorm-entity';
import { BodaConfigService } from './boda-config.service';

const DEV_KEY = 'a'.repeat(64);

describe('BodaConfigService', () => {
  let svc: BodaConfigService;
  let findOne: jest.Mock;
  let create: jest.Mock;
  let save: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn();
    save = jest.fn(async (r) => ({ ...r, id: r.id ?? 'new-id' }));
    create = jest.fn((dto) => ({ ...dto }));
    const mod = await Test.createTestingModule({
      providers: [
        BodaConfigService,
        {
          provide: getRepositoryToken(BodaConfigTypeormEntity, ACM_DS),
          useValue: { findOne, create, save },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) => (k === 'BODA_CRYPTO_KEY' ? DEV_KEY : undefined),
          },
        },
      ],
    }).compile();
    svc = mod.get(BodaConfigService);
  });

  describe('findByEntId', () => {
    it('returns null when no row', async () => {
      findOne.mockResolvedValue(null);
      expect(await svc.findByEntId('e1')).toBeNull();
    });

    it('masks secrets — only is_set booleans', async () => {
      findOne.mockResolvedValue({
        id: 'cfg-1',
        entId: 'e1',
        bodaWebUrl: 'https://bodaedu.kr',
        svrUrl: 'https://svr.bodaedu.kr',
        webrtcUrl: 'https://bodaedu.kr/webrtc',
        companyCode: 'C',
        companyId: 'I',
        defaultRoomCode: 'R',
        authKeyEnc: Buffer.from([1, 2, 3]),
        eventSecretEnc: null,
        webhookAllowCidrs: '1.2.3.4',
        graceBeforeMin: 10,
        graceAfterMin: 15,
        reconcileDelayMin: 10,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const res = await svc.findByEntId('e1');
      expect(res?.authKeyIsSet).toBe(true);
      expect(res?.eventSecretIsSet).toBe(false);
      // Plaintext / encrypted bytes must NOT appear anywhere in the response.
      // The field NAMES `authKeyIsSet` / `eventSecretIsSet` are fine — what
      // matters is that the actual secret-bearing keys aren't there.
      const keys = Object.keys(res as object);
      expect(keys).not.toContain('authKey');
      expect(keys).not.toContain('authKeyEnc');
      expect(keys).not.toContain('eventSecret');
      expect(keys).not.toContain('eventSecretEnc');
      expect(keys).toContain('authKeyIsSet');
      expect(keys).toContain('eventSecretIsSet');
    });
  });

  describe('upsertByEntId — create', () => {
    it('creates row with secrets encrypted (Buffer in BYTEA)', async () => {
      findOne.mockResolvedValue(null);
      await svc.upsertByEntId('e1', {
        bodaWebUrl: 'https://bodaedu.kr',
        svrUrl: 'https://svr.bodaedu.kr',
        webrtcUrl: 'https://bodaedu.kr/webrtc',
        companyCode: 'C',
        companyId: 'I',
        defaultRoomCode: 'R',
        authKey: 'secret-key',
        eventSecret: 'webhook-secret',
      });
      const created = create.mock.calls[0][0] as BodaConfigTypeormEntity;
      expect(created.authKeyEnc).toBeInstanceOf(Buffer);
      expect(created.eventSecretEnc).toBeInstanceOf(Buffer);
      // Plaintext must NOT appear in the BYTEA blob — at least not contiguous bytes.
      // (AES-GCM with random IV makes this almost impossible by construction.)
      expect(created.authKeyEnc?.toString('utf8')).not.toContain('secret-key');
    });

    it('falls back to defaults for unset numeric/bool fields', async () => {
      findOne.mockResolvedValue(null);
      await svc.upsertByEntId('e1', {});
      const created = create.mock.calls[0][0] as BodaConfigTypeormEntity;
      expect(created.graceBeforeMin).toBe(10);
      expect(created.graceAfterMin).toBe(15);
      expect(created.reconcileDelayMin).toBe(10);
      expect(created.isActive).toBe(true);
    });
  });

  describe('upsertByEntId — update', () => {
    const existing = (): BodaConfigTypeormEntity => ({
      id: 'cfg-1',
      entId: 'e1',
      bodaWebUrl: 'old-web',
      svrUrl: 'old-svr',
      webrtcUrl: 'old-rtc',
      companyCode: 'OC',
      companyId: 'OI',
      defaultRoomCode: 'OR',
      authKeyEnc: Buffer.from('PRE-EXISTING-ENC'),
      eventSecretEnc: null,
      webhookAllowCidrs: null,
      graceBeforeMin: 10,
      graceAfterMin: 15,
      reconcileDelayMin: 10,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('omitted authKey keeps existing encrypted blob', async () => {
      findOne.mockResolvedValue(existing());
      await svc.upsertByEntId('e1', { bodaWebUrl: 'https://new-url.example' });
      const saved = save.mock.calls[0][0] as BodaConfigTypeormEntity;
      expect(saved.bodaWebUrl).toBe('https://new-url.example');
      expect(saved.authKeyEnc?.toString('utf8')).toContain('PRE-EXISTING-ENC');
    });

    it('provided authKey replaces existing blob (new IV → new ciphertext)', async () => {
      findOne.mockResolvedValue(existing());
      await svc.upsertByEntId('e1', { authKey: 'rotated-key' });
      const saved = save.mock.calls[0][0] as BodaConfigTypeormEntity;
      expect(saved.authKeyEnc).toBeInstanceOf(Buffer);
      expect(saved.authKeyEnc?.toString('utf8')).not.toContain(
        'PRE-EXISTING-ENC',
      );
      expect(saved.authKeyEnc?.toString('utf8')).not.toContain('rotated-key');
    });
  });

  describe('crypto-key fail-closed', () => {
    let svcNoKey: BodaConfigService;
    beforeEach(async () => {
      const mod = await Test.createTestingModule({
        providers: [
          BodaConfigService,
          {
            provide: getRepositoryToken(BodaConfigTypeormEntity, ACM_DS),
            useValue: { findOne, create, save },
          },
          {
            provide: ConfigService,
            useValue: { get: () => undefined },
          },
        ],
      }).compile();
      svcNoKey = mod.get(BodaConfigService);
    });

    it('throws 503 when secret write attempted without BODA_CRYPTO_KEY', async () => {
      findOne.mockResolvedValue(null);
      const err = await svcNoKey
        .upsertByEntId('e1', { authKey: 'k' })
        .catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'BODA_CRYPTO_KEY_NOT_SET',
      });
    });

    it('allows non-secret upsert when key missing (read-side only)', async () => {
      findOne.mockResolvedValue(null);
      await expect(
        svcNoKey.upsertByEntId('e1', { bodaWebUrl: 'https://x' }),
      ).resolves.toBeDefined();
    });

    it('getDecrypted* returns null when key missing', async () => {
      findOne.mockResolvedValue({
        authKeyEnc: Buffer.from('blob'),
      });
      expect(await svcNoKey.getDecryptedAuthKey('e1')).toBeNull();
    });
  });

  describe('getDecrypted* round-trip', () => {
    it('decrypts authKey via the same crypto key used for encryption', async () => {
      findOne.mockResolvedValueOnce(null); // for upsert
      await svc.upsertByEntId('e1', {
        bodaWebUrl: 'https://x',
        authKey: 'live-auth-key',
      });
      // Use saved entity for the second lookup
      const saved = save.mock.calls[0][0] as BodaConfigTypeormEntity;
      findOne.mockResolvedValueOnce(saved);
      expect(await svc.getDecryptedAuthKey('e1')).toBe('live-auth-key');
    });
  });
});
