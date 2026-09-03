import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MailerService, SendMailInput } from '../../../infrastructure/mailer/mailer.service';
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

  async send(entId: string, input: SendMailInput): Promise<void> {
    const t = await this.configSvc.getTransport(entId);
    if (!t) {
      await this.envMailer.send(input);
      return;
    }
    await this.sendVia(t, input);
  }

  /** 설정 페이지 테스트 발송 — 저장된 테넌트 설정으로만 시도(env fallback 없음). */
  async sendTest(entId: string, to: string): Promise<void> {
    const t = await this.configSvc.getTransport(entId);
    if (!t) {
      throw new Error('MAIL_CONFIG_NOT_SET');
    }
    await this.sendVia(t, {
      to,
      subject: '[ACM] 메일 설정 테스트 / Mail configuration test',
      text: '이 메일이 보이면 SMTP 설정이 정상입니다.\nIf you can read this, your SMTP configuration works.',
    });
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
      });
    } finally {
      transporter.close();
    }
  }
}
