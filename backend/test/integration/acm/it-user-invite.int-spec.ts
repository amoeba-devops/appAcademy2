import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { AcmAuthService } from '../../../src/modules/acm-auth/application/acm-auth.service';
import { UserInviteService } from '../../../src/modules/acm-system/application/user-invite.service';
import type { TenantMailerService } from '../../../src/modules/acm-system/application/tenant-mailer.service';
import type { AcmCurrentUser } from '../../../src/modules/acm-common/decorators/current-user.decorator';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261018 — 서비스 운영자 사용자 초대: 메일 링크 → 비밀번호 설정 → 가입·로그인,
 * 1회용·만료·취소·중복 이메일. 실제 AcmAuthService·DB, 메일만 대체.
 */
describe('IT-USER-INVITE', () => {
  let env: AcmTestEnv;
  let svc: UserInviteService;
  const ENT = '00000000-0000-0000-0000-000000000001';
  let operatorId: string;
  const sent: { to: string; text?: string }[] = [];
  let mailReady = true;
  const mailer = {
    isConfigured: () => Promise.resolve(mailReady),
    send: (_e: string, m: { to: string; text?: string }) => {
      sent.push(m);
      return Promise.resolve();
    },
  } as unknown as TenantMailerService;
  const op = (): AcmCurrentUser =>
    ({ id: operatorId, entId: ENT, role: 'ADMIN' }) as AcmCurrentUser;
  const tokenFrom = (text?: string) =>
    /invite\?token=([A-Za-z0-9_-]+)/.exec(text ?? '')?.[1] ?? '';
  const PW = 'Invite2026ok';

  beforeAll(async () => {
    env = await bootAcmTestEnv();
    svc = new UserInviteService(
      env.ds,
      env.app.get(AcmAuthService),
      mailer,
      new ConfigService({ ACM_PUBLIC_URL: 'https://acm.example' }),
    );
    [{ usr_id: operatorId }] = await env.ds.query<{ usr_id: string }[]>(
      `SELECT usr_id FROM amb_acm_user WHERE usr_email='admin@tpi.co.kr'`,
    );
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  it('mails a single-use link; accepting creates the user and logs in', async () => {
    const r = await svc.create(op(), {
      email: ' New.Staff@tpi.co.kr ',
      name: '신규 직원',
      role: 'STAFF',
    });
    expect(r.mailSent).toBe(true);
    expect(r.inviteUrl).toBeUndefined();
    const token = tokenFrom(sent.at(-1)?.text);
    expect(sent.at(-1)?.to).toBe('new.staff@tpi.co.kr');
    const [row] = await env.ds.query<{ inv_token_hash: string }[]>(
      `SELECT inv_token_hash FROM amb_acm_user_invite WHERE inv_id=$1`,
      [r.id],
    );
    expect(row.inv_token_hash).not.toBe(token);

    const info = await svc.describe(token);
    expect(info).toMatchObject({ email: 'new.staff@tpi.co.kr', role: 'STAFF' });

    await expect(svc.accept(token, 'short')).rejects.toThrow();
    const ok = await svc.accept(token, PW);
    expect(JSON.stringify(ok)).toContain('accessToken');
    const [u] = await env.ds.query<
      { usr_role: string; usr_must_change_password: boolean }[]
    >(
      `SELECT usr_role, usr_must_change_password FROM amb_acm_user WHERE usr_email='new.staff@tpi.co.kr'`,
    );
    expect(u).toEqual({ usr_role: 'STAFF', usr_must_change_password: false });
    const login = await request(env.app.getHttpServer())
      .post('/api/acm/auth/login')
      .send({ email: 'new.staff@tpi.co.kr', password: PW });
    expect(login.status).toBe(200);

    // 1회용
    await expect(svc.accept(token, PW)).rejects.toMatchObject({ status: 410 });
  });

  it('refuses existing emails; shows the link once without mail; grants only the operator permission', async () => {
    await expect(
      svc.create(op(), { email: 'admin@tpi.co.kr', name: 'x', role: 'ADMIN' }),
    ).rejects.toThrow();
    mailReady = false;
    const r = await svc.create(op(), {
      email: 'ops@tpi.co.kr',
      name: '운영',
      role: 'ADMIN',
      grantConfigAdmin: true,
    });
    mailReady = true;
    expect(r.mailSent).toBe(false);
    const token = tokenFrom(r.inviteUrl);
    expect(token.length).toBeGreaterThan(20);
    const usr = await svc.accept(token, PW);
    expect(usr).toBeTruthy();
    const perms = await env.ds.query<{ upr_permission: string }[]>(
      `SELECT p.upr_permission FROM amb_acm_user_permission p JOIN amb_acm_user u ON u.usr_id=p.usr_id WHERE u.usr_email='ops@tpi.co.kr'`,
    );
    expect(perms.map((p) => p.upr_permission)).toEqual(['CONFIG_ADMIN']);
  });

  it('expires, revokes and resends (old link stops working)', async () => {
    const a = await svc.create(op(), {
      email: 'late@tpi.co.kr',
      name: 'a',
      role: 'STAFF',
    });
    const oldToken = tokenFrom(sent.at(-1)?.text);
    await svc.resend(op(), a.id);
    const newToken = tokenFrom(sent.at(-1)?.text);
    await expect(svc.describe(oldToken)).rejects.toThrow();
    await env.ds.query(
      `UPDATE amb_acm_user_invite SET inv_expires_at = now() - interval '1 minute' WHERE inv_id=$1`,
      [a.id],
    );
    await expect(svc.accept(newToken, PW)).rejects.toThrow();
    const list = await svc.list(op(), 'EXPIRED');
    expect(list.map((x) => x.inv_email)).toContain('late@tpi.co.kr');

    const b = await svc.create(op(), {
      email: 'cancel@tpi.co.kr',
      name: 'b',
      role: 'STAFF',
    });
    const bToken = tokenFrom(sent.at(-1)?.text);
    await svc.revoke(op(), b.id);
    await expect(svc.describe(bToken)).rejects.toThrow();
    await expect(svc.revoke(op(), b.id)).rejects.toThrow();
  });
});
