import { ConfigService } from '@nestjs/config';
import { AmoebaTalkHttpService } from './amoebatalk-client.service';
import {
  AmoebaTalkBadRequestException,
  AmoebaTalkServiceUnavailableException,
} from './amoebatalk.exceptions';

function makeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const env: Record<string, unknown> = {
    AMOEBATALK_API_URL: 'https://amoebatalk.example.com',
    AMOEBATALK_API_KEY: 'test-key',
    AMOEBATALK_HMAC_SECRET: 'test-secret',
    AMOEBATALK_TIMEOUT_MS: 5000,
    ...overrides,
  };
  return {
    get: (key: string, fallback?: unknown) => env[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('AmoebaTalkHttpService', () => {
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

  it('T-4: send — 200 OK returns DTO with HMAC + Bearer headers', async () => {
    const svc = new AmoebaTalkHttpService(makeConfig());
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ messageId: 'msg-001', status: 'ACCEPTED' }),
    });

    const r = await svc.send({
      to: '010-1234-5678',
      templateCode: 'PAYMENT_DONE',
      variables: { orderNo: 'O-1' },
    });

    expect(r.messageId).toBe('msg-001');
    expect(r.status).toBe('ACCEPTED');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toBe('https://amoebatalk.example.com/api/v1/messages');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');
    expect(headers['X-Ama-Timestamp']).toMatch(/^\d+$/);
    expect(headers['X-Ama-Signature']).toMatch(/^[0-9a-f]{64}$/);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('T-5: 5xx → retry once then throw ServiceUnavailable', async () => {
    jest.useFakeTimers();
    const svc = new AmoebaTalkHttpService(makeConfig());
    fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => 'oops' });

    const promise = svc.send({
      to: '010',
      templateCode: 'X',
      variables: {},
    });
    const settled = promise.then(
      (v) => ({ ok: true as const, v }),
      (e) => ({ ok: false as const, e }),
    );
    await jest.runAllTimersAsync();
    const r = await settled;

    expect(r.ok).toBe(false);
    expect((r as { ok: false; e: unknown }).e).toBeInstanceOf(
      AmoebaTalkServiceUnavailableException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('T-6: 4xx → no retry, throws BadRequest immediately', async () => {
    const svc = new AmoebaTalkHttpService(makeConfig());
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'invalid template',
    });

    await expect(
      svc.send({ to: '010', templateCode: 'X', variables: {} }),
    ).rejects.toBeInstanceOf(AmoebaTalkBadRequestException);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
