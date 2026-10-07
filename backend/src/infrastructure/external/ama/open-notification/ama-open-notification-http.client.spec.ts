import { ConfigService } from '@nestjs/config';
import {
  AmaOpenNotificationHttpClient,
  DEFAULT_OPEN_NOTIFICATIONS_PATH,
} from './ama-open-notification-http.client';
import { AmaOpenNotificationRequest } from './ama-open-notification.client';

/**
 * FIX-261007: AMA 게이트웨이 경로(/ama/v1/notifications)·PartnerApp 코드 오버라이드.
 * compose 가 `${VAR:-}` 로 빈 문자열을 넘겨도 기본값이 적용되어야 한다.
 */
function makeClient(env: Record<string, string | undefined>) {
  const config = {
    get: (key: string, def?: unknown) => (key in env ? env[key] : def),
  } as unknown as ConfigService;
  return new AmaOpenNotificationHttpClient(config);
}

const baseEnv = {
  AMA_GATEWAY_URL: 'https://api.amoeba.site/',
  AMA_CLIENT_ID: 'pap_x',
  AMA_CLIENT_SECRET: 'secret',
};

const req: AmaOpenNotificationRequest = {
  entityId: '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b',
  appCode: 'tpi-academy',
  dedupeKey: 'acm:test:1',
  title: 't',
  body: 'b',
  link: 'https://acm.amoeba.site/login?returnTo=%2Fadmin%2Fdashboard',
  recipientUserIds: ['c31e3cc1-c8c2-4a9a-8dbb-c0c39d6b6570'],
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AmaOpenNotificationHttpClient (FIX-261007)', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/oauth/token')) {
        return jsonResponse(200, { success: true, data: { access_token: 'tok', expires_in: 3600 } });
      }
      return jsonResponse(201, { success: true, data: { created: 1, skipped: 0 } });
    });
  });

  afterEach(() => fetchMock.mockRestore());

  const postedCall = () => fetchMock.mock.calls.find(([u]) => !String(u).endsWith('/oauth/token'))!;

  it('경로 미설정·빈 문자열이면 게이트웨이 경로 /ama/v1/notifications 로 보낸다', async () => {
    for (const path of [undefined, '', '  ']) {
      fetchMock.mockClear();
      const client = makeClient({ ...baseEnv, AMA_OPEN_NOTIFICATIONS_PATH: path });
      await client.send(req);
      expect(String(postedCall()[0])).toBe(`https://api.amoeba.site${DEFAULT_OPEN_NOTIFICATIONS_PATH}`);
    }
  });

  it('APP_CODE 가 있으면 PartnerApp 코드로 덮어쓴다', async () => {
    const client = makeClient({ ...baseEnv, AMA_OPEN_NOTIFICATIONS_APP_CODE: 'tpi-acm' });
    const res = await client.send(req);
    const body = JSON.parse(String((postedCall()[1] as RequestInit).body));
    expect(body.appCode).toBe('tpi-acm');
    expect(res).toEqual({ created: 1, skipped: 0 });
  });

  it('APP_CODE 가 비어 있으면 요청의 appCode 를 그대로 쓴다', async () => {
    const client = makeClient({ ...baseEnv, AMA_OPEN_NOTIFICATIONS_APP_CODE: '' });
    await client.send(req);
    const body = JSON.parse(String((postedCall()[1] as RequestInit).body));
    expect(body.appCode).toBe('tpi-academy');
  });

  it('409 는 중복으로 성공 처리', async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/oauth/token')
        ? jsonResponse(200, { success: true, data: { access_token: 'tok', expires_in: 3600 } })
        : jsonResponse(409, { success: false, error: { code: 'E5301', message: 'duplicate_dedupe_key' } }),
    );
    const client = makeClient(baseEnv);
    await expect(client.send(req)).resolves.toMatchObject({ created: 0, duplicate: true });
  });
});
