import type { Repository } from 'typeorm';
import type { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { AiConfigService } from './ai-config.service';
import { AiConfigTypeormEntity } from '../infrastructure/typeorm/ai-config.typeorm-entity';

describe('AiConfigService', () => {
  let row: AiConfigTypeormEntity | null;
  let service: AiConfigService;

  beforeEach(() => {
    row = null;
    const repo = {
      findOne: jest.fn(async () => row),
      create: jest.fn((value: Partial<AiConfigTypeormEntity>) => Object.assign(new AiConfigTypeormEntity(), value)),
      save: jest.fn(async (value: AiConfigTypeormEntity) => { row = value; return value; }),
    } as unknown as Repository<AiConfigTypeormEntity>;
    const aes = {
      encrypt: jest.fn((value: string) => ({ iv: Buffer.alloc(12), authTag: Buffer.alloc(16), ciphertext: Buffer.from(value) })),
      decrypt: jest.fn((value: { ciphertext: Buffer }) => value.ciphertext.toString()),
    } as unknown as AesGcmService;
    service = new AiConfigService(repo, aes);
  });

  it('encrypts a submitted key and exposes only apiKeyIsSet', async () => {
    const result = await service.upsert('tenant-a', {
      provider: 'OPENAI', modelId: 'gpt-test', apiKey: 'secret-marker', isActive: false,
    });
    expect(result.apiKeyIsSet).toBe(true);
    expect(JSON.stringify(result)).not.toContain('secret-marker');
    expect(row?.apiKeyEnc?.toString()).not.toBe('secret-marker');
  });

  it('keeps the encrypted key when a blank key is submitted', async () => {
    await service.upsert('tenant-a', { provider: 'OPENAI', modelId: 'gpt-test', apiKey: 'first-key', isActive: false });
    const before = row?.apiKeyEnc;
    await service.upsert('tenant-a', { provider: 'OPENAI', modelId: 'gpt-test', apiKey: '   ', isActive: false });
    expect(row?.apiKeyEnc).toBe(before);
  });

  it('removes the key and deactivates the engine', async () => {
    await service.upsert('tenant-a', { provider: 'OPENAI', modelId: 'gpt-test', apiKey: 'first-key', isActive: false });
    if (row) row.isActive = true;
    const result = await service.removeKey('tenant-a');
    expect(result.apiKeyIsSet).toBe(false);
    expect(result.isActive).toBe(false);
  });
});
