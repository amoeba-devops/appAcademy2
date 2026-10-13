import { validPushEndpoint, PushService } from './push.service';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InboxService } from './inbox.service';
describe('push endpoint boundary', () => {
  it.each([
    'http://fcm.googleapis.com/a',
    'https://127.0.0.1/a',
    'https://localhost/a',
    'https://fcm.googleapis.com.evil.test/a',
    'https://fcm.googleapis.com:8443/a',
    'https://x:y@fcm.googleapis.com/a',
  ])('rejects %s', (u) => expect(validPushEndpoint(u)).toBe(false));
  it.each([
    'https://fcm.googleapis.com/a',
    'https://web.push.apple.com/a',
    'https://updates.push.services.mozilla.com/a',
  ])('accepts %s', (u) => expect(validPushEndpoint(u)).toBe(true));
  it('does not send or enqueue without configured keys', async () => {
    const query = jest.fn();
    const svc = new PushService(
      { query } as unknown as DataSource,
      new ConfigService({}),
      {} as InboxService,
    );
    expect(svc.info()).toEqual({ enabled: false, publicKey: null });
    await svc.deliver();
    expect(query).not.toHaveBeenCalled();
  });
});

import * as webpush from 'web-push';
jest.mock('web-push', () => ({ sendNotification: jest.fn() }));
describe('push delivery', () => {
  function setup(item: unknown) {
    const row = {
      id: 'delivery',
      subscriptionId: 'sub',
      inboxId: 'inbox',
      entId: 'tenant',
      kind: 'USER',
      recipient: 'user',
      subscription: {
        endpoint: 'https://fcm.googleapis.com/a',
        keys: { auth: 'a', p256dh: 'k' },
      },
      attempts: 1,
    };
    const query = jest.fn(async (..._args: unknown[]) => []);
    const ds = {
      query,
      transaction: async (fn: (m: unknown) => Promise<unknown>) =>
        fn({ query: async () => [row] }),
    };
    const inbox = {
      unreadItem: async () => item,
      href: () => '/admin/chat?channelId=c&messageId=m',
    };
    const svc = new PushService(
      ds as unknown as DataSource,
      new ConfigService({
        WEB_PUSH_PUBLIC_KEY: 'public',
        WEB_PUSH_PRIVATE_KEY: 'private',
        WEB_PUSH_SUBJECT: 'mailto:test@example.invalid',
      }),
      inbox as unknown as InboxService,
    );
    return { svc, query };
  }
  beforeEach(() => jest.clearAllMocks());
  it('skips read or no-longer-accessible notifications', async () => {
    const { svc } = setup(undefined);
    await svc.deliver();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
  it('sends a safe generic preview with an exact target', async () => {
    const { svc } = setup({ id: 'inbox' });
    await svc.deliver();
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(
      String(jest.mocked(webpush.sendNotification).mock.calls[0][1]),
    ) as { url: string; actor: string; body: string };
    expect(payload.url).toBe(
      '/admin/chat?channelId=c&messageId=m&notificationId=inbox',
    );
    expect(payload.actor).toBe('tenant:USER:user');
    expect(payload.body).not.toContain('private');
  });
  it('removes expired endpoints and retains transient errors for retry', async () => {
    const { svc, query } = setup({ id: 'inbox' });
    jest
      .mocked(webpush.sendNotification)
      .mockRejectedValueOnce({ statusCode: 410 });
    await svc.deliver();
    expect(
      query.mock.calls.some((c) => String(c[0]).startsWith('DELETE')),
    ).toBe(true);
    query.mockClear();
    jest
      .mocked(webpush.sendNotification)
      .mockRejectedValueOnce({ statusCode: 503 });
    await svc.deliver();
    expect(
      query.mock.calls.some((c) => String(c[0]).includes('pdl_done_at')),
    ).toBe(false);
  });
});
