import { VideoConfigService } from './video-config.service';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantMailerService } from '../../acm-system/application/tenant-mailer.service';
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
    private readonly mailer: TenantMailerService,
    private readonly inviteeSvc: CalInviteeService,
    private readonly config: ConfigService,
    private readonly video: VideoConfigService,
  ) {}

  /** Notify a freshly added batch. Updates each invitee's status. */
  async notifyAdded(
    entId: string,
    event: CalEventTypeormEntity,
    addedRows: CalInviteeTypeormEntity[],
    recurrenceSummary?: string,
  ): Promise<NotifySummary> {
    const summary: NotifySummary = {
      sent: 0,
      skippedNoEmail: 0,
      skippedNoSmtp: 0,
      failed: 0,
    };
    if (addedRows.length === 0) return summary;

    const includeMeetingLink =
      event.meetingProvider !== 'BODASCHOOL' ||
      (await this.video.get(entId)).bodaEnabled;
    const hydrated = await this.inviteeSvc.hydrate(entId, addedRows);
    const smtpReady = await this.mailer.isConfigured(entId);

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
          await this.mailer.send(
            entId,
            this.renderInvite(
              event,
              inv,
              includeMeetingLink,
              recurrenceSummary,
            ),
          );
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

  /**
   * REQ-261023 — class link changed by the teacher. Sent only when the teacher ticks the box.
   * Does not touch the invite status columns (those track the original invitation).
   */
  async notifyLinkChanged(
    entId: string,
    event: { title: string; startAt: Date; meetingUrl: string | null },
    rows: CalInviteeTypeormEntity[],
    exceptRefId: string | null,
    laterCount: number,
  ): Promise<NotifySummary> {
    const summary: NotifySummary = { sent: 0, skippedNoEmail: 0, skippedNoSmtp: 0, failed: 0 };
    const targets = rows.filter((r) => !(r.kind === 'TEACHER' && r.refId === exceptRefId));
    if (!targets.length) return summary;
    const hydrated = await this.inviteeSvc.hydrate(entId, targets);
    const smtpReady = await this.mailer.isConfigured(entId);
    const portal = this.config.get<string>('ACM_PORTAL_URL') ?? '';
    const when = event.startAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
    await Promise.allSettled(
      hydrated.map(async (inv) => {
        if (!inv.email) return void summary.skippedNoEmail++;
        if (!smtpReady) return void summary.skippedNoSmtp++;
        try {
          await this.mailer.send(entId, {
            to: inv.email,
            subject: `[수업 링크 변경] ${event.title}`,
            text: [
              `${inv.name}님께`,
              '',
              '수업 링크가 변경되었습니다.',
              '',
              `수업: ${event.title}`,
              `일시: ${when}${laterCount > 0 ? ` (이후 ${laterCount}회 수업에도 적용)` : ''}`,
              event.meetingUrl ? `새 링크: ${event.meetingUrl}` : '링크가 삭제되었습니다. 새 링크는 포털에서 확인해 주세요.',
              portal ? `\n포털 바로가기: ${portal}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          });
          summary.sent++;
        } catch (e: unknown) {
          this.log.error(`link-change notify failed inv=${inv.id} err=${e instanceof Error ? e.message : String(e)}`);
          summary.failed++;
        }
      }),
    );
    return summary;
  }

  private renderInvite(
    event: CalEventTypeormEntity,
    inv: InviteeView,
    includeMeetingLink: boolean,
    recurrenceSummary?: string,
  ) {
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
      recurrenceSummary ?? '',
      event.locationText ? `장소: ${event.locationText}` : '',
      includeMeetingLink && event.meetingUrl
        ? `미팅 URL: ${event.meetingUrl}`
        : '',
      portal ? `\n포털 바로가기: ${portal}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return { to: inv.email!, subject, text };
  }
}
