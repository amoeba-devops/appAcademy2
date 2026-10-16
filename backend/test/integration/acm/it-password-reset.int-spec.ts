import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { AcmAuthService } from '../../../src/modules/acm-auth/application/acm-auth.service';
import { PasswordResetService } from '../../../src/modules/acm-system/application/password-reset.service';
import type { TenantMailerService } from '../../../src/modules/acm-system/application/tenant-mailer.service';
import type { AcmCurrentUser } from '../../../src/modules/acm-common/decorators/current-user.decorator';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261017 — 비밀번호 재발급 요청 → 관리자 임시 비밀번호 발급(메일/1회 표시) → 24시간 만료 → 변경.
 * 실제 AcmAuthService·DB 를 쓰고 메일만 대체한다.
 */
describe('IT-PASSWORD-RESET temp password flow', () => {
  let env: AcmTestEnv;
  let svc: PasswordResetService;
  const ENT = '00000000-0000-0000-0000-000000000001';
  const EMAIL = 'admin@tpi.co.kr';
  let userId: string;
  const sent: { to: string; text?: string }[] = [];
  let mailReady = true;
  const mailer = {
    isConfigured: () => Promise.resolve(mailReady),
    send: (_ent: string, m: { to: string; text?: string }) => {
      sent.push(m);
      return Promise.resolve();
    },
  } as unknown as TenantMailerService;
  const admin = (): AcmCurrentUser =>
    ({ id: userId, entId: ENT, role: 'ADMIN' }) as AcmCurrentUser;
  const login = (password: string) =>
    request(env.app.getHttpServer())
      .post('/api/acm/auth/login')
      .send({ email: EMAIL, password });
  const outbox = async () =>
    (
      await env.ds.query<{ c: number }[]>(
        `SELECT count(*)::int c FROM amb_acm_notification_outbox WHERE nob_type='PASSWORD_RESET_REQUEST'`,
      )
    )[0].c;

  beforeAll(async () => {
    env = await bootAcmTestEnv();
    svc = new PasswordResetService(
      env.ds,
      env.app.get(AcmAuthService),
      mailer,
      new ConfigService({ ACM_PUBLIC_URL: 'https://acm.example' }),
    );
    [{ usr_id: userId }] = await env.ds.query<{ usr_id: string }[]>(
      `SELECT usr_id FROM amb_acm_user WHERE usr_email=$1`,
      [EMAIL],
    );
    // 알림을 받을 다른 관리자(요청자 본인은 알림 대상에서 빠진다)
    await env.ds.query(
      `INSERT INTO amb_acm_user (ent_id, usr_email, usr_name, usr_status, usr_role)
       VALUES ($1, 'other-admin@tpi.co.kr', 'Other Admin', 'ACTIVE', 'ADMIN')`,
      [ENT],
    );
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  it('answers the same for unknown and known emails, deduplicates within the cooldown', async () => {
    await expect(svc.request('nobody@example.com', '1.1.1.1')).resolves.toEqual(
      { ok: true },
    );
    await expect(svc.request(' ADMIN@tpi.co.kr ', '1.1.1.1')).resolves.toEqual({
      ok: true,
    });
    await svc.request(EMAIL, '1.1.1.1');
    const rows = await env.ds.query<
      { prr_status: string; prr_ip_hash: string }[]
    >(`SELECT prr_status, prr_ip_hash FROM amb_acm_password_reset_request`);
    expect(rows).toHaveLength(1);
    expect(rows[0].prr_status).toBe('REQUESTED');
    expect(rows[0].prr_ip_hash).not.toContain('1.1.1.1');
  });

  it('lists requests for tenant admins only', async () => {
    const list = await svc.list(admin());
    expect(list).toEqual([
      expect.objectContaining({ usr_email: EMAIL, prr_status: 'REQUESTED' }),
    ]);
    await expect(
      svc.list({ id: userId, entId: ENT, role: 'STAFF' } as AcmCurrentUser),
    ).rejects.toThrow();
  });

  it('issues a temp password by mail (not returned), forces change, and closes the request', async () => {
    const [{ prr_id }] = await env.ds.query<{ prr_id: string }[]>(
      `SELECT prr_id FROM amb_acm_password_reset_request`,
    );
    const r = await svc.issueForRequest(admin(), prr_id);
    expect(r.mailSent).toBe(true);
    expect(r.tempPassword).toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(EMAIL);
    const password = /임시 비밀번호: (\S+)/.exec(sent[0].text ?? '')?.[1] ?? '';
    expect(password).toMatch(/^[A-Za-z0-9]{10}$/);
    const res = await login(password).expect(200);
    expect(res.body.user.mustChangePassword).toBe(true);
    await expect(svc.issueForRequest(admin(), prr_id)).rejects.toThrow();
    const [u] = await env.ds.query<{ hours: number }[]>(
      `SELECT extract(epoch FROM usr_temp_password_expires_at - now())/3600 AS hours FROM amb_acm_user WHERE usr_id=$1`,
      [userId],
    );
    expect(Number(u.hours)).toBeGreaterThan(23);
    expect(Number(u.hours)).toBeLessThanOrEqual(24);
    expect(await outbox()).toBe(1);
  });

  it('returns the temp password once when mail is not configured; expired temp password is rejected', async () => {
    mailReady = false;
    const r = await svc.issueForUser(admin(), userId);
    expect(r).toMatchObject({ mailSent: false });
    expect(r.tempPassword).toMatch(/^[A-Za-z0-9]{10}$/);
    await env.ds.query(
      `UPDATE amb_acm_user SET usr_temp_password_expires_at = now() - interval '1 minute' WHERE usr_id=$1`,
      [userId],
    );
    const res = await login(r.tempPassword!).expect(401);
    expect(JSON.stringify(res.body)).toContain('TEMP_PASSWORD_EXPIRED');
    mailReady = true;
  });

  it('does not let a tenant admin issue for another tenant; reject closes a request', async () => {
    await expect(
      svc.issueForUser(
        {
          id: userId,
          entId: '99999999-9999-4999-8999-999999999999',
          role: 'ADMIN',
        } as AcmCurrentUser,
        userId,
      ),
    ).rejects.toThrow();
    await env.ds.query(
      `UPDATE amb_acm_password_reset_request SET prr_requested_at = now() - interval '1 hour'`,
    );
    await svc.request(EMAIL);
    const [{ prr_id }] = await env.ds.query<{ prr_id: string }[]>(
      `SELECT prr_id FROM amb_acm_password_reset_request WHERE prr_status='REQUESTED'`,
    );
    await svc.reject(admin(), prr_id);
    const [{ prr_status }] = await env.ds.query<{ prr_status: string }[]>(
      `SELECT prr_status FROM amb_acm_password_reset_request WHERE prr_id=$1`,
      [prr_id],
    );
    expect(prr_status).toBe('REJECTED');
  });
});
