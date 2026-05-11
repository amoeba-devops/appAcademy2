import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendMailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

@Injectable()
export class MailerService {
  private readonly log = new Logger(MailerService.name);
  private transporter: Transporter | null = null;
  private fromAddress: string | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = String(this.config.get<string>('SMTP_SECURE') ?? 'false') === 'true';
    const from = this.config.get<string>('SMTP_FROM');

    if (!host || !from) {
      this.log.warn('SMTP not configured (SMTP_HOST or SMTP_FROM missing). Mailer is in NO-OP mode.');
      return;
    }

    this.fromAddress = from;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    this.log.log(`Mailer configured host=${host}:${port} secure=${secure} from=${from}`);
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(input: SendMailInput): Promise<void> {
    if (!this.transporter || !this.fromAddress) {
      throw new Error('SMTP_NOT_CONFIGURED');
    }
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  }
}
