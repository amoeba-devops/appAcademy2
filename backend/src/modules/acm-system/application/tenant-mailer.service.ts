import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  MailerService,
  SendMailInput,
} from '../../../infrastructure/mailer/mailer.service';
import { MailConfigService, MailTransport } from './mail-config.service';

/**
 * REQ-260902B — 테넌트 인식 메일 발송.
 * 테넌트 DB 설정(amb_acm_mail_config, active) 우선, 없으면 env 기반
 * MailerService fallback. transporter는 발송량이 적어 호출마다 생성
 * (레포 관행: 테넌트 설정 무캐시 read-per-use).
 */
@Injectable()
export class TenantMailerService {
  private readonly log = new Logger(TenantMailerService.name);

  constructor(
    private readonly configSvc: MailConfigService,
    private readonly envMailer: MailerService,
  ) {}

  async isConfigured(entId: string): Promise<boolean> {
    const t = await this.configSvc.getTransport(entId);
    if (t) return true;
    return this.envMailer.isConfigured();
  }

  /**
   * REQ-261112I — 메일 설정의 기본 숨은참조(BCC)를 붙여 발송.
   * 비밀번호·초대 링크가 담긴 메일은 `skipDefaultBcc` 로 제외한다.
   */
  async send(
    entId: string,
    input: SendMailInput,
    opts: SendOptions = {},
  ): Promise<void> {
    const withBcc = opts.skipDefaultBcc
      ? input
      : await this.withDefaultBcc(entId, input);
    const t = await this.configSvc.getTransport(entId);
    if (!t) {
      await this.envMailer.send(withBcc);
      return;
    }
    await this.sendVia(t, withBcc);
  }

  /** 설정 페이지 테스트 발송 — 저장된 테넌트 설정으로만 시도(env fallback 없음). */
  async sendTest(entId: string, to: string): Promise<void> {
    const t = await this.configSvc.getTransport(entId);
    if (!t) {
      throw new Error('MAIL_CONFIG_NOT_SET');
    }
    // REQ-261112I — 테스트 메일에도 기본 BCC 를 붙여 사본 수신을 함께 확인한다.
    const input = await this.withDefaultBcc(entId, {
      to,
      subject: '[ACM] 메일 설정 테스트 / Mail configuration test',
      text: '이 메일이 보이면 SMTP 설정이 정상입니다.\nIf you can read this, your SMTP configuration works.',
    });
    await this.sendVia(t, input);
    this.log.log(`test mail sent ent=${entId} to=${to}`);
  }

  private async sendVia(t: MailTransport, input: SendMailInput): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: t.host,
      port: t.port,
      secure: t.secure,
      auth: t.user && t.pass ? { user: t.user, pass: t.pass } : undefined,
    });
    try {
      await transporter.sendMail({
        from: t.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        bcc: input.bcc?.length ? input.bcc : undefined,
      });
    } finally {
      transporter.close();
    }
  }

  /** 기본 BCC 를 합친다 — 받는 사람·중복 주소 제외(대소문자 무시). */
  private async withDefaultBcc(
    entId: string,
    input: SendMailInput,
  ): Promise<SendMailInput> {
    const defaults = await this.configSvc.getDefaultBcc(entId);
    if (!defaults.length) return input;
    const seen = new Set(
      input.to
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    );
    const bcc: string[] = [];
    for (const addr of [...(input.bcc ?? []), ...defaults]) {
      const key = addr.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      bcc.push(addr.trim());
    }
    return bcc.length ? { ...input, bcc } : input;
  }
}

export interface SendOptions {
  /** REQ-261112I — 비밀번호·초대 링크 메일 등 기본 BCC 제외 */
  skipDefaultBcc?: boolean;
}
