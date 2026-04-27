import { ConfigService } from '@nestjs/config';
import { AmaClientHttpService } from './ama-client.service';
import { AmaServiceUnavailableException } from './ama.exceptions';

function makeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const env: Record<string, unknown> = {
    AMA_API_URL: 'https://ama.example.com',
    AMA_API_KEY: 'test-key',
    AMA_HMAC_SECRET: 'test-secret',
    AMA_TIMEOUT_MS: 5000,
    ...overrides,
  };
  return {
    get: (key: string, fallback?: unknown) => env[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('AmaClientHttpService', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    (global as unknown as { fetch: typeof fetch }).fetch = realFetch;
    jest.useRealTimers();
  });

  it('getClient — 200 OK returns DTO with required headers', async () => {
    const svc = new AmaClientHttpService(makeConfig());
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          id: 'CL-2026-0001',
          name: '홍길동',
          phone: '010-1234-5678',
          email: 'hong@example.com',
          status: 'ACTIVE',
          updatedAt: '2026-04-01T00:00:00Z',
        }),
    });

    const c = await svc.getClient('CL-2026-0001');

    expect(c).not.toBeNull();
    expect(c!.amaClientId).toBe('CL-2026-0001');
    expect(c!.name).toBe('홍길동');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toBe('https://ama.example.com/api/v1/clients/CL-2026-0001');
    expect(init.method).toBe('GET');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');
    expect(headers['X-Ama-Timestamp']).toMatch(/^\d+$/);
    expect(headers['X-Ama-Signature']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('getClient — 404 returns null without retry', async () => {
    const svc = new AmaClientHttpService(makeConfig());
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, text: async () => '' });

    const c = await svc.getClient('CL-MISSING');

    expect(c).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry on 404
  });

  it('getClient — transient error retries once then throws 503', async () => {
    jest.useFakeTimers();
    const svc = new AmaClientHttpService(makeConfig());
    fetchMock.mockRejectedValue(new Error('network down'));

    const promise = svc.getClient('CL-2026-0001');
    // Attach a catch handler before pumping timers so the rejection is observed.
    const settled = promise.then(
      (v) => ({ ok: true as const, v }),
      (e) => ({ ok: false as const, e }),
    );
    await jest.runAllTimersAsync();
    const result = await settled;

    expect(result.ok).toBe(false);
    expect((result as { ok: false; e: unknown }).e).toBeInstanceOf(
      AmaServiceUnavailableException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 try + 1 retry
  });

  it('searchClients — paginated result is mapped to DTO', async () => {
    const svc = new AmaClientHttpService(makeConfig());
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            {
              id: 'CL-2026-0001',
              name: '홍길동',
              phone: '010-1234-5678',
              status: 'ACTIVE',
              updatedAt: '2026-04-01T00:00:00Z',
            },
          ],
          meta: { page: 1, limit: 20, total: 1 },
        }),
    });

    const r = await svc.searchClients('홍', 1, 20);

    expect(r.data).toHaveLength(1);
    expect(r.data[0].amaClientId).toBe('CL-2026-0001');
    expect(r.meta).toEqual({ page: 1, limit: 20, total: 1 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('q=%ED%99%8D');
    expect(url).toContain('page=1');
    expect(url).toContain('limit=20');
  });
});
