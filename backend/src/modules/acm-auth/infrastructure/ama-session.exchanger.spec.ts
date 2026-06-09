import {
  AmaIntrospectResult,
  AmaOAuthRejectedException,
  AmaOAuthTokenResult,
  AmaOAuthUnavailableException,
  IAmaOAuthClient,
} from './ama-oauth.client';
import { AmaSessionExchanger } from './ama-session.exchanger';

function makeClient(over: Partial<IAmaOAuthClient> = {}): {
  client: IAmaOAuthClient;
  exchange: jest.Mock;
  introspect: jest.Mock;
} {
  const exchange = jest.fn<Promise<AmaOAuthTokenResult>, [string]>(
    async () => ({ accessToken: 'at-1', scope: 'app_store:context', expiresIn: 3600 }),
  );
  const introspect = jest.fn<Promise<AmaIntrospectResult>, [string]>(
    async () => ({
      active: true,
      sub: 'user-1',
      entId: 'ent-1',
      scope: 'app_store:context',
      clientId: 'pap_x',
      iat: 1000,
      exp: 5000,
    }),
  );
  const client = { exchangeSession: exchange, introspect, ...over } as IAmaOAuthClient;
  return { client, exchange, introspect };
}

describe('AmaSessionExchanger (REQ-260609C)', () => {
  it('exchanges + introspects → AmaTokenPayload (sub/entityId from introspect)', async () => {
    const { client } = makeClient();
    const svc = new AmaSessionExchanger(client);
    const p = await svc.verify('ama-token');
    expect(p.sub).toBe('user-1');
    expect(p.entityId).toBe('ent-1');
    expect(p.scope).toBe('app_store:context');
    expect(p.appCode).toBe('pap_x'); // client_id, for logging only
    expect(p.email).toBe(''); // backfilled later from membership
    expect(p.role).toBe('UNKNOWN');
  });

  it('rejects when introspect returns active=false', async () => {
    const { client } = makeClient({ introspect: jest.fn(async () => ({ active: false })) });
    const svc = new AmaSessionExchanger(client);
    await expect(svc.verify('t')).rejects.toBeInstanceOf(AmaOAuthRejectedException);
  });

  it('rejects when sub or entId is missing', async () => {
    const { client } = makeClient({
      introspect: jest.fn(async () => ({ active: true, sub: 'u' })), // no entId
    });
    const svc = new AmaSessionExchanger(client);
    await expect(svc.verify('t')).rejects.toMatchObject({ code: 'invalid_ama_token' });
  });

  it('propagates unavailable from exchange (→ caller 503)', async () => {
    const { client } = makeClient({
      exchangeSession: jest.fn(async () => {
        throw new AmaOAuthUnavailableException('timeout');
      }),
    });
    const svc = new AmaSessionExchanger(client);
    await expect(svc.verify('t')).rejects.toBeInstanceOf(AmaOAuthUnavailableException);
  });

  it('caches introspect for the same access_token (single introspect call)', async () => {
    const { client, exchange, introspect } = makeClient();
    const svc = new AmaSessionExchanger(client);
    await svc.verify('ama-token');
    await svc.verify('ama-token'); // same → same access_token at-1 → cached
    expect(exchange).toHaveBeenCalledTimes(2);
    expect(introspect).toHaveBeenCalledTimes(1);
  });
});
