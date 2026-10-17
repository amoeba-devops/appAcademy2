import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { AcmAuthService } from '../../../src/modules/acm-auth/application/acm-auth.service';
import { AcmSeedPasswordService } from '../../../src/modules/acm-auth/application/acm-seed-password.service';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261017B — 저장소에 공개된 시드 비밀번호 하드닝.
 * 1045 로 변경 강제, 운영 모드 로그인 거부, ACM_INITIAL_ADMIN_PASSWORD 로 기동 시 교체.
 */
describe('IT-SEED-PASSWORD public seed password hardening', () => {
  let env: AcmTestEnv;
  const SEED_EMAIL = 'admin@tpi.co.kr';
  const SEED_PASSWORD = 'acm20261234';
  const INITIAL = 'Initial2026Strong';
  const login = (password: string) =>
    request(env.app.getHttpServer())
      .post('/api/acm/auth/login')
      .send({ email: SEED_EMAIL, password });
  const seedService = (initial?: string) =>
    new AcmSeedPasswordService(
      env.ds,
      new ConfigService(initial ? { ACM_INITIAL_ADMIN_PASSWORD: initial } : {}),
    );
  const setProduction = (on: boolean) => {
    // 테스트 환경(NODE_ENV=test)에서 운영 모드 동작만 확인한다.
    (
      env.app.get(AcmAuthService) as unknown as { isProduction: boolean }
    ).isProduction = on;
  };

  beforeAll(async () => {
    env = await bootAcmTestEnv();
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  it('1045 forces a change for accounts still on a public seed password', async () => {
    const [u] = await env.ds.query<{ usr_must_change_password: boolean }[]>(
      `SELECT usr_must_change_password FROM amb_acm_user WHERE usr_email=$1`,
      [SEED_EMAIL],
    );
    expect(u.usr_must_change_password).toBe(true);
    const res = await login(SEED_PASSWORD).expect(200);
    expect(res.body.user.mustChangePassword).toBe(true);
  });

  it('refuses the seed password in production mode, but a wrong password stays generic', async () => {
    setProduction(true);
    try {
      const res = await login(SEED_PASSWORD).expect(401);
      expect(JSON.stringify(res.body)).toContain('SEED_PASSWORD_DISABLED');
      const wrong = await login('wrong-password-1').expect(401);
      expect(JSON.stringify(wrong.body)).not.toContain(
        'SEED_PASSWORD_DISABLED',
      );
    } finally {
      setProduction(false);
    }
  });

  it('only warns without ACM_INITIAL_ADMIN_PASSWORD and ignores a weak one', async () => {
    await expect(seedService().run()).resolves.toEqual({
      found: 2,
      replaced: 0,
    });
    await expect(seedService('short1').run()).resolves.toEqual({
      found: 2,
      replaced: 0,
    });
  });

  it('replaces the seed password from ACM_INITIAL_ADMIN_PASSWORD and requires a change', async () => {
    await expect(seedService(INITIAL).run()).resolves.toEqual({
      found: 2,
      replaced: 2,
    });
    await login(SEED_PASSWORD).expect(401);
    const res = await login(INITIAL).expect(200);
    expect(res.body.user.mustChangePassword).toBe(true);
    await expect(seedService(INITIAL).run()).resolves.toEqual({
      found: 0,
      replaced: 0,
    });
  });
});
