import { TenantMailerService } from './tenant-mailer.service';
import type { MailConfigService } from './mail-config.service';
import type {
  MailerService,
  SendMailInput,
} from '../../../infrastructure/mailer/mailer.service';

/** REQ-261112I — 기본 숨은참조(BCC) 부착 규칙. env fallback 경로로 검증한다. */
describe('TenantMailerService default BCC', () => {
  const ENT = '00000000-0000-0000-0000-000000000001';

  function build(defaultBcc: string[]) {
    const configSvc = {
      getTransport: jest.fn().mockResolvedValue(null),
      getDefaultBcc: jest.fn().mockResolvedValue(defaultBcc),
    } as unknown as MailConfigService;
    const envMailer = {
      isConfigured: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue(undefined),
    } as unknown as MailerService;
    return { svc: new TenantMailerService(configSvc, envMailer), envMailer };
  }

  const sent = (m: MailerService) =>
    (m.send as jest.Mock).mock.calls[0][0] as SendMailInput;

  it('설정된 주소를 BCC 로 붙인다', async () => {
    const { svc, envMailer } = build(['tpiyeri@tpiglobal.network']);
    await svc.send(ENT, { to: 'parent@example.com', subject: 's', text: 't' });
    expect(sent(envMailer).bcc).toEqual(['tpiyeri@tpiglobal.network']);
    expect(sent(envMailer).to).toBe('parent@example.com');
  });

  it('받는 사람·중복 주소는 BCC 에서 뺀다', async () => {
    const { svc, envMailer } = build([
      'TPIYERI@tpiglobal.network',
      'a@x.com',
      'a@x.com',
    ]);
    await svc.send(ENT, { to: 'tpiyeri@tpiglobal.network', subject: 's' });
    expect(sent(envMailer).bcc).toEqual(['a@x.com']);
  });

  it('받는 사람이 BCC 주소뿐이면 BCC 를 붙이지 않는다', async () => {
    const { svc, envMailer } = build(['tpiyeri@tpiglobal.network']);
    await svc.send(ENT, { to: 'tpiyeri@tpiglobal.network', subject: 's' });
    expect(sent(envMailer).bcc).toBeUndefined();
  });

  it('skipDefaultBcc 면 붙이지 않는다 (초대·임시 비밀번호)', async () => {
    const { svc, envMailer } = build(['tpiyeri@tpiglobal.network']);
    await svc.send(
      ENT,
      { to: 'u@example.com', subject: 's' },
      { skipDefaultBcc: true },
    );
    expect(sent(envMailer).bcc).toBeUndefined();
  });

  it('미설정이면 BCC 없음', async () => {
    const { svc, envMailer } = build([]);
    await svc.send(ENT, { to: 'u@example.com', subject: 's' });
    expect(sent(envMailer).bcc).toBeUndefined();
  });
});
