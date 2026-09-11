import { generateKeyPairSync } from 'crypto';
import { Ga4ConfigService } from './ga4-config.service';
import type { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import type { Ga4DataClient } from '../../acm-common/ga4/ga4-data.client';
import type { Repository } from 'typeorm';
import type { Ga4ConfigTypeormEntity } from '../infrastructure/typeorm/ga4-config.typeorm-entity';

/** PLN-260912 — key encryption/masking, stream map cleaning, sync-config gating. */
describe('Ga4ConfigService', () => {
  const ENT = '00000000-0000-0000-0000-000000000001';
  const pem = generateKeyPairSync('rsa', { modulusLength: 2048 })
    .privateKey.export({ type: 'pkcs8', format: 'pem' })
    .toString();
  const saJson = JSON.stringify({
    client_email: 'acm@p.iam.gserviceaccount.com',
    private_key: pem,
  });

  let store: Partial<Ga4ConfigTypeormEntity> | null;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
  };
  let aes: { encrypt: jest.Mock; decrypt: jest.Mock };
  let ga4: { runReport: jest.Mock };
  let svc: Ga4ConfigService;

  beforeEach(() => {
    store = null;
    repo = {
      findOne: jest.fn(async () => store),
      create: jest.fn((v) => ({ ...v })),
      save: jest.fn(async (row) => {
        store = { ...row, updatedAt: new Date('2026-09-12T00:00:00Z') };
        return store;
      }),
      update: jest.fn(),
      find: jest.fn(),
    };
    // fake AES: reversible tagging so decrypt(encrypt(x)) === x
    aes = {
      encrypt: jest.fn((s: string) => ({
        iv: Buffer.alloc(12),
        authTag: Buffer.alloc(16),
        ciphertext: Buffer.from(s),
      })),
      decrypt: jest.fn((f: { ciphertext: Buffer }) => f.ciphertext.toString()),
    };
    ga4 = { runReport: jest.fn() };
    svc = new Ga4ConfigService(
      repo as unknown as Repository<Ga4ConfigTypeormEntity>,
      aes as unknown as AesGcmService,
      ga4 as unknown as Ga4DataClient,
    );
  });

  it('upsert encrypts the SA key, stores the email, cleans the stream map, and masks in the view', async () => {
    const v = await svc.upsertByEntId(ENT, {
      propertyId: ' 123456 ',
      streamMap: { TPI: '111', TRINITY: 'abc222', SANTACROCE: '', OTHER: '9' },
      saKeyJson: saJson,
      metric: 'sessions',
    });
    expect(aes.encrypt).toHaveBeenCalledWith(saJson);
    expect(v).toMatchObject({
      propertyId: '123456',
      streamMap: { TPI: '111', TRINITY: '222' },
      saEmail: 'acm@p.iam.gserviceaccount.com',
      saKeyIsSet: true,
      metric: 'sessions',
      isActive: true,
    });
    expect((v as unknown as Record<string, unknown>).saKeyJson).toBeUndefined();
  });

  it('upsert rejects an invalid SA key JSON', async () => {
    await expect(svc.upsertByEntId(ENT, { saKeyJson: '{bad' })).rejects.toThrow(
      'GA4_SA_KEY_INVALID_JSON',
    );
  });

  it('getSyncConfig decrypts the key and inverts the stream map; null when inactive or incomplete', async () => {
    await svc.upsertByEntId(ENT, {
      propertyId: '1',
      streamMap: { TPI: '111' },
      saKeyJson: saJson,
    });
    const cfg = await svc.getSyncConfig(ENT);
    expect(cfg).toMatchObject({
      propertyId: '1',
      streamToSite: { '111': 'TPI' },
      metric: 'activeUsers',
    });
    expect(cfg?.key.client_email).toBe('acm@p.iam.gserviceaccount.com');

    await svc.upsertByEntId(ENT, { isActive: false });
    expect(await svc.getSyncConfig(ENT)).toBeNull();

    await svc.upsertByEntId(ENT, { isActive: true, saKeyJson: '' });
    expect(await svc.getSyncConfig(ENT)).toBeNull();
  });

  it('testConnection runs a 7-day report and reports distinct streams', async () => {
    await svc.upsertByEntId(ENT, {
      propertyId: '1',
      streamMap: { TPI: '111' },
      saKeyJson: saJson,
    });
    ga4.runReport.mockResolvedValue([
      { date: '2026-09-10', streamId: '111', metrics: { activeUsers: 1 } },
      { date: '2026-09-11', streamId: '111', metrics: { activeUsers: 2 } },
      { date: '2026-09-11', streamId: '222', metrics: { activeUsers: 3 } },
    ]);
    const r = await svc.testConnection(ENT);
    expect(r).toEqual({ ok: true, rows: 3, streams: ['111', '222'] });
    expect(ga4.runReport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ propertyId: '1', metrics: ['activeUsers'] }),
    );
  });

  it('testConnection throws GA4_CONFIG_NOT_SET without config', async () => {
    await expect(svc.testConnection(ENT)).rejects.toThrow('GA4_CONFIG_NOT_SET');
  });
});
