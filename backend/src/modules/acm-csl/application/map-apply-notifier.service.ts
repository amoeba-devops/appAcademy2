import { Injectable, Logger } from '@nestjs/common';
import { SolapiAlimtalkService } from '../../acm-system/application/solapi-alimtalk.service';
import { KakaoConfigService } from '../../acm-system/application/kakao-config.service';
import { MailConfigService } from '../../acm-system/application/mail-config.service';
import { TenantMailerService } from '../../acm-system/application/tenant-mailer.service';
import { TenantSettingsService } from '../../acm-system/application/tenant-settings.service';
import { NotificationService } from '../../acm-notification/application/notification.service';

export interface MapApplyNotifyInput {
  inqId: string;
  seqNo: number;
  site: string;
  studentName: string;
  parentPhone: string;
  parentEmail: string | null;
  preferredSlot: string | null;
  examLocation: string | null;
}

const TPL_PARENT_ALIMTALK = 'CSL_MAP_APPLY_ALIMTALK';
const TPL_PARENT_EMAIL = 'CSL_MAP_APPLY_EMAIL';
const TPL_OPERATOR_EMAIL = 'CSL_MAP_APPLY_OPERATOR_EMAIL';

const SITE_LABEL: Record<string, string> = {
  TPI: 'TPI',
  TRINITY: '트리니티 프렙 아카데미',
  SANTACROCE: '산타크로체',
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * CSL-PLN-260916 §9 — 맵테스트 신청 접수 알림.
 *
 * 학부모: 알림톡(설정 시) + 이메일(이메일 입력 시). 운영자: 이메일(수신자 설정 시).
 * 콘솔 실시간 알림은 기존 `acm.csl.created` → SSE 경로가 담당한다.
 *
 * **모든 발송은 best-effort** — 실패해도 접수는 성공으로 남긴다 (FR-9).
 */
@Injectable()
export class MapApplyNotifierService {
  private readonly log = new Logger(MapApplyNotifierService.name);

  constructor(
    private readonly alimtalk: SolapiAlimtalkService,
    private readonly kakaoConfig: KakaoConfigService,
    private readonly mailConfig: MailConfigService,
    private readonly mailer: TenantMailerService,
    private readonly tenantSettings: TenantSettingsService,
    private readonly notifications: NotificationService,
  ) {}

  async notifyNewApplication(
    entId: string,
    input: MapApplyNotifyInput,
  ): Promise<void> {
    const academyName = await this.safeAcademyName(entId);
    await Promise.allSettled([
      this.sendParentAlimtalk(entId, input, academyName),
      this.sendParentEmail(entId, input, academyName),
      this.sendOperatorEmail(entId, input, academyName),
    ]);
  }

  // ── 학부모 알림톡 ──────────────────────────────────────────────────
  private async sendParentAlimtalk(
    entId: string,
    input: MapApplyNotifyInput,
    academyName: string,
  ): Promise<void> {
    const templateId = await this.kakaoConfig.getMapApplyTemplateId(entId);
    if (!templateId) {
      await this.safeLog({
        entId,
        templateCode: TPL_PARENT_ALIMTALK,
        channel: 'ALIMTALK',
        recipientKind: 'PARENT',
        toAddress: input.parentPhone,
        status: 'SKIPPED',
        error: 'MAP_APPLY_TEMPLATE_NOT_SET',
      });
      return;
    }
    try {
      await this.alimtalk.sendWithTemplate(
        entId,
        input.parentPhone,
        templateId,
        {
          '#{학원명}': academyName,
          '#{학생명}': input.studentName,
          '#{수업명}': 'MAP TEST 응시',
          '#{일시}': input.preferredSlot || '담당자 확인 후 안내',
        },
      );
      await this.safeLog({
        entId,
        templateCode: TPL_PARENT_ALIMTALK,
        channel: 'ALIMTALK',
        recipientKind: 'PARENT',
        toAddress: input.parentPhone,
        status: 'SENT',
        sentAt: new Date(),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`map-apply alimtalk failed inq=${input.inqId}: ${msg}`);
      await this.safeLog({
        entId,
        templateCode: TPL_PARENT_ALIMTALK,
        channel: 'ALIMTALK',
        recipientKind: 'PARENT',
        toAddress: input.parentPhone,
        status: 'FAILED',
        error: msg.slice(0, 500),
      });
    }
  }

  // ── 학부모 이메일 ──────────────────────────────────────────────────
  private async sendParentEmail(
    entId: string,
    input: MapApplyNotifyInput,
    academyName: string,
  ): Promise<void> {
    if (!input.parentEmail) return;
    const subject = `[${academyName}] MAP TEST 응시 신청이 접수되었습니다`;
    const html = [
      `<p>안녕하세요, <strong>${esc(academyName)}</strong> 입니다.</p>`,
      `<p>아래 내용으로 MAP TEST 응시 신청이 정상 접수되었습니다.</p>`,
      '<ul>',
      `<li>학생: ${esc(input.studentName)}</li>`,
      `<li>응시 희망: ${esc(input.preferredSlot || '미지정 (담당자 확인 후 안내)')}</li>`,
      `<li>응시 지역: ${esc(input.examLocation || '미입력')}</li>`,
      `<li>접수번호: #${input.seqNo}</li>`,
      '</ul>',
      '<p>담당자가 확인 후 안내 연락을 드리겠습니다. 감사합니다.</p>',
    ].join('\n');
    await this.trySend(
      entId,
      TPL_PARENT_EMAIL,
      'PARENT',
      input.parentEmail,
      subject,
      html,
    );
  }

  // ── 운영자 이메일 ──────────────────────────────────────────────────
  private async sendOperatorEmail(
    entId: string,
    input: MapApplyNotifyInput,
    academyName: string,
  ): Promise<void> {
    const recipients = await this.mailConfig.getOperatorEmails(entId);
    if (!recipients.length) return;
    const site = SITE_LABEL[input.site] ?? input.site;
    const subject = `[${academyName}] 새 MAP TEST 신청 #${input.seqNo} (${site})`;
    const html = [
      '<p>새 MAP TEST 응시 신청이 접수되었습니다.</p>',
      '<ul>',
      `<li>접수번호: #${input.seqNo}</li>`,
      `<li>사이트: ${esc(site)}</li>`,
      `<li>학생: ${esc(input.studentName)}</li>`,
      `<li>연락처: ${esc(input.parentPhone)}</li>`,
      `<li>응시 희망: ${esc(input.preferredSlot || '미지정')}</li>`,
      `<li>응시 지역: ${esc(input.examLocation || '미입력')}</li>`,
      '</ul>',
      `<p>콘솔에서 확인: /admin/test</p>`,
    ].join('\n');
    for (const to of recipients) {
      await this.trySend(entId, TPL_OPERATOR_EMAIL, 'STAFF', to, subject, html);
    }
  }

  // ── 공통 ───────────────────────────────────────────────────────────
  private async trySend(
    entId: string,
    templateCode: string,
    recipientKind: 'PARENT' | 'STAFF',
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    try {
      if (!(await this.mailer.isConfigured(entId))) {
        await this.safeLog({
          entId,
          templateCode,
          channel: 'EMAIL',
          recipientKind,
          toAddress: to,
          subject,
          status: 'SKIPPED',
          error: 'MAIL_NOT_CONFIGURED',
        });
        return;
      }
      await this.mailer.send(entId, { to, subject, html });
      await this.safeLog({
        entId,
        templateCode,
        channel: 'EMAIL',
        recipientKind,
        toAddress: to,
        subject,
        status: 'SENT',
        sentAt: new Date(),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`map-apply email failed to=${to}: ${msg}`);
      await this.safeLog({
        entId,
        templateCode,
        channel: 'EMAIL',
        recipientKind,
        toAddress: to,
        subject,
        status: 'FAILED',
        error: msg.slice(0, 500),
      });
    }
  }

  private async safeAcademyName(entId: string): Promise<string> {
    try {
      return (await this.tenantSettings.getTenantName(entId)) || 'ACM';
    } catch {
      return 'ACM';
    }
  }

  private async safeLog(
    input: Parameters<NotificationService['appendLog']>[0],
  ): Promise<void> {
    try {
      await this.notifications.appendLog(input);
    } catch (e: unknown) {
      this.log.debug(
        `notification log write failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
