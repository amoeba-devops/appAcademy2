import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../../../infrastructure/mailer/mailer.service';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import { CalInviteeTypeormEntity } from '../infrastructure/typeorm/cal-invitee.typeorm-entity';
import { CalInviteeService, InviteeView } from './cal-invitee.service';

export interface NotifySummary {
  sent: number;
  skippedNoEmail: number;
  skippedNoSmtp: number;
  failed: number;
}

@Injectable()
export class InviteeNotifierService {
  private readonly log = new Logger(InviteeNotifierService.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly inviteeSvc: CalInviteeService,
    private readonly config: ConfigService,
  ) {}

  /** Notify a freshly added batch. Updates each invitee's status. */
  async notifyAdded(
    entId: string,
    event: CalEventTypeormEntity,
    addedRows: CalInviteeTypeormEntity[],
  ): Promise<NotifySummary> {
    const summary: NotifySummary = {
      sent: 0,
      skippedNoEmail: 0,
      skippedNoSmtp: 0,
      failed: 0,
    };
    if (addedRows.length === 0) return summary;

    const hydrated = await this.inviteeSvc.hydrate(entId, addedRows);
    const smtpReady = this.mailer.isConfigured();

    await Promise.allSettled(
      hydrated.map(async (inv) => {
        if (!inv.email) {
          await this.inviteeSvc.updateNotifyStatus(inv.id, 'SKIPPED_NO_EMAIL');
          summary.skippedNoEmail++;
          return;
        }
        if (!smtpReady) {
          await this.inviteeSvc.updateNotifyStatus(inv.id, 'SKIPPED_NO_SMTP');
          summary.skippedNoSmtp++;
          return;
        }
        try {
          await this.mailer.send(this.renderInvite(event, inv));
          await this.inviteeSvc.updateNotifyStatus(inv.id, 'SENT');
          summary.sent++;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          this.log.error(`notify failed inv=${inv.id} err=${msg}`);
          await this.inviteeSvc.updateNotifyStatus(inv.id, 'FAILED', msg);
          summary.failed++;
        }
      }),
    );

    return summary;
  }

  private renderInvite(event: CalEventTypeormEntity, inv: InviteeView) {
    const portal = this.config.get<string>('ACM_PORTAL_URL') ?? '';
    const start = event.startAt.toISOString();
    const end = event.endAt.toISOString();
    const subject = `[일정 안내] ${event.title}`;
    const text = [
      `${inv.name}님께`,
      '',
      `다음 일정에 초대되었습니다.`,
      ``,
      `제목: ${event.title}`,
      `시작: ${start}`,
      `종료: ${end}`,
      event.locationText ? `장소: ${event.locationText}` : '',
      event.meetingUrl ? `미팅 URL: ${event.meetingUrl}` : '',
      portal ? `\n포털 바로가기: ${portal}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return { to: inv.email!, subject, text };
  }
}
