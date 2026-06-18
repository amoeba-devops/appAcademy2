import { ConfigService } from '@nestjs/config';
import { AmaPlatformHttpClient } from './ama-platform-http.client';

/**
 * FIX-260619 — the AMA platform directory returns the amoeba `{ success, data }`
 * envelope, but the REQ-260604 A3 contract was speced as a bare array. These
 * tests pin that the client accepts BOTH shapes (the envelope mismatch is what
 * made the tch/stf picker silently return empty in production).
 */
describe('AmaPlatformHttpClient (envelope tolerance)', () => {
  const config = new ConfigService({
    AMA_PLATFORM_BASE_URL: 'https://ama.example',
    AMA_PLATFORM_SERVICE_TOKEN: 'svc-token',
    AMA_PLATFORM_TIMEOUT_MS: 3000,
  });
  let client: AmaPlatformHttpClient;
  let fetchMock: jest.SpyInstance;

  const ok = (body: unknown): Response =>
    ({
      status: 200,
      ok: true,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as unknown as Response;

  const mgr = {
    userId: 'u1',
    entityId: 'e1',
    level: 'MANAGER',
    name: 'Fremd',
    email: 'fremd@x',
  };

  beforeEach(() => {
    client = new AmaPlatformHttpClient(config);
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  describe('searchUsers', () => {
    it('reads the { success, data: [...] } envelope', async () => {
      fetchMock.mockResolvedValue(ok({ success: true, data: [mgr] }));
      const res = await client.searchUsers('e1', 'fremd', ['MANAGER'], 10);
      expect(res.map((u) => u.userId)).toEqual(['u1']);
    });

    it('still reads a bare array (backward-compatible)', async () => {
      fetchMock.mockResolvedValue(ok([mgr]));
      const res = await client.searchUsers('e1', 'fremd', ['MANAGER'], 10);
      expect(res.map((u) => u.userId)).toEqual(['u1']);
    });

    it('returns [] for an unrecognised payload shape', async () => {
      fetchMock.mockResolvedValue(ok({ success: true, items: [mgr] }));
      const res = await client.searchUsers('e1', 'fremd', ['MANAGER'], 10);
      expect(res).toEqual([]);
    });
  });

  describe('assertMember', () => {
    it('reads the { success, data: {...} } envelope', async () => {
      fetchMock.mockResolvedValue(ok({ success: true, data: mgr }));
      const res = await client.assertMember('e1', 'u1');
      expect(res?.userId).toBe('u1');
    });

    it('still reads a bare object (backward-compatible)', async () => {
      fetchMock.mockResolvedValue(ok(mgr));
      const res = await client.assertMember('e1', 'u1');
      expect(res?.userId).toBe('u1');
    });
  });
});
