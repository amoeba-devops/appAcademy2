import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PortalLoginDto } from './portal-account.dto';

/**
 * PLN-260714 — 학생 포털 로그인ID는 이메일(DB pac_login_id VARCHAR(200)).
 * loginId 길이 상한이 40 이면 긴 이메일 로그인이 거부되는 회귀가 발생하므로,
 * DTO 검증이 최대 200자까지 허용하는지 가드한다.
 */
describe('PortalLoginDto.loginId length', () => {
  const errorsFor = (loginId: string) =>
    validateSync(
      plainToInstance(PortalLoginDto, {
        tenantCode: 'tpi',
        loginId,
        password: 'Xk7m2Qp9aR',
      }),
    ).filter((e) => e.property === 'loginId');

  it('accepts a long email login id (> 40 chars)', () => {
    const longEmail = `${'a'.repeat(48)}@subdomain.example.co.kr`; // 71 chars
    expect(longEmail.length).toBeGreaterThan(40);
    expect(errorsFor(longEmail)).toHaveLength(0);
  });

  it('accepts an email login id up to the 200-char cap', () => {
    const local = 'a'.repeat(200 - '@example.com'.length);
    const maxEmail = `${local}@example.com`; // exactly 200 chars
    expect(maxEmail.length).toBe(200);
    expect(errorsFor(maxEmail)).toHaveLength(0);
  });

  it('rejects a login id over 200 chars', () => {
    expect(errorsFor('a'.repeat(201))).not.toHaveLength(0);
  });

  it('rejects a login id shorter than 3 chars', () => {
    expect(errorsFor('ab')).not.toHaveLength(0);
  });
});
