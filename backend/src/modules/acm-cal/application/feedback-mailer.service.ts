import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { MailerService } from '../../../infrastructure/mailer/mailer.service';
import { ACM_DS } from '../../acm-common/datasource';
import { NotificationService } from '../../acm-notification/application/notification.service';
import { ParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { StudentParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student-parent.typeorm-entity';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import { CalEventReviewTypeormEntity } from '../infrastructure/typeorm/cal-event-review.typeorm-entity';
import { CalInviteeTypeormEntity } from '../infrastructure/typeorm/cal-invitee.typeorm-entity';

/**
 * REQ-260902 — 수업 피드백 학부모 메일 발송.
 * 수신 대상 = 이벤트 STUDENT 초대자의 연결 학부모(amb_acm_std_student_parent).
 * 발송 이력은 amb_acm_notification_log(channel=EMAIL, recipient_kind=PARENT).
 * 메일 본문은 피드백만 포함(숙제 제외 — 요구사항 Q-B 확정).
 */
export const FEEDBACK_EMAIL_TEMPLATE_CODE = 'CAL_FEEDBACK_EMAIL';

export interface FeedbackRecipientParent {
  parId: string;
  name: string;
  relation: string | null;
  email: string | null;
  isPrimary: boolean;
}

export interface FeedbackRecipientStudent {
  stdId: string;
  stdName: string;
  parents: FeedbackRecipientParent[];
}

export interface FeedbackRecipientsView {
  smtpConfigured: boolean;
  hasFeedback: boolean;
  students: FeedbackRecipientStudent[];
}

export type FeedbackSendStatus = 'SENT' | 'NO_EMAIL' | 'FAILED';

export interface FeedbackSendResult {
  stdId: string;
  parId: string;
  status: FeedbackSendStatus;
  error?: string;
}

@Injectable()
export class FeedbackMailerService {
  private readonly log = new Logger(FeedbackMailerService.name);

  constructor(
    @InjectRepository(CalEventTypeormEntity, ACM_DS)
    private readonly events: Repository<CalEventTypeormEntity>,
    @InjectRepository(CalEventReviewTypeormEntity, ACM_DS)
    private readonly reviews: Repository<CalEventReviewTypeormEntity>,
    @InjectRepository(CalInviteeTypeormEntity, ACM_DS)
    private readonly invitees: Repository<CalInviteeTypeormEntity>,
    @InjectRepository(StudentTypeormEntity, ACM_DS)
    private readonly students: Repository<StudentTypeormEntity>,
    @InjectRepository(StudentParentTypeormEntity, ACM_DS)
    private readonly studentParents: Repository<StudentParentTypeormEntity>,
    @InjectRepository(ParentTypeormEntity, ACM_DS)
    private readonly parents: Repository<ParentTypeormEntity>,
    private readonly mailer: MailerService,
    private readonly notifications: NotificationService,
  ) {}

  async listRecipients(
    entId: string,
    evtId: string,
  ): Promise<FeedbackRecipientsView> {
    const event = await this.getEvent(entId, evtId);
    const review = await this.reviews.findOne({
      where: { entId, evtId: event.id },
    });
    return {
      smtpConfigured: this.mailer.isConfigured(),
      hasFeedback: !!review?.feedbackHtml?.trim(),
      students: await this.resolveStudents(entId, event.id),
    };
  }

  async sendFeedbackEmail(
    entId: string,
    evtId: string,
    input: {
      recipients: Array<{ stdId: string; parId: string }>;
      subject?: string;
    },
  ): Promise<{ results: FeedbackSendResult[] }> {
    const event = await this.getEvent(entId, evtId);
    const review = await this.reviews.findOne({
      where: { entId, evtId: event.id },
    });
    const feedbackHtml = review?.feedbackHtml?.trim();
    if (!feedbackHtml) {
      throw new UnprocessableEntityException('NO_FEEDBACK');
    }
    if (!this.mailer.isConfigured()) {
      throw new ServiceUnavailableException('SMTP_NOT_CONFIGURED');
    }

    // 요청 수신자가 실제 이벤트 참여 학생·연결 학부모인지 재검증.
    const studentsView = await this.resolveStudents(entId, event.id);
    const validPairs = new Map<string, FeedbackRecipientParent>();
    const studentNames = new Map<string, string>();
    for (const s of studentsView) {
      studentNames.set(s.stdId, s.stdName);
      for (const p of s.parents) {
        validPairs.set(`${s.stdId}:${p.parId}`, p);
      }
    }
    for (const r of input.recipients) {
      if (!validPairs.has(`${r.stdId}:${r.parId}`)) {
        throw new BadRequestException('INVALID_RECIPIENT');
      }
    }

    const subject =
      input.subject?.trim() ||
      `[수업 피드백] ${event.title} — ${this.formatKst(event.startAt)}`;
    const bodySummary = this.htmlToSummary(feedbackHtml);

    const results: FeedbackSendResult[] = [];
    for (const r of input.recipients) {
      const parent = validPairs.get(`${r.stdId}:${r.parId}`)!;
      const stdName = studentNames.get(r.stdId) ?? '';
      const result = await this.sendOne(
        entId,
        event,
        feedbackHtml,
        subject,
        bodySummary,
        stdName,
        r.stdId,
        parent,
      );
      results.push(result);
    }
    return { results };
  }

  private async sendOne(
    entId: string,
    event: CalEventTypeormEntity,
    feedbackHtml: string,
    subject: string,
    bodySummary: string,
    stdName: string,
    stdId: string,
    parent: FeedbackRecipientParent,
  ): Promise<FeedbackSendResult> {
    const base = {
      entId,
      templateCode: FEEDBACK_EMAIL_TEMPLATE_CODE,
      channel: 'EMAIL',
      recipientKind: 'PARENT' as const,
      recipientId: parent.parId,
      toAddress: parent.email ?? null,
      subject,
      bodySummary,
    };
    if (!parent.email?.trim()) {
      await this.safeLog({ ...base, status: 'SKIPPED' });
      return { stdId, parId: parent.parId, status: 'NO_EMAIL' };
    }
    try {
      await this.mailer.send({
        to: parent.email,
        subject,
        html: this.renderBody(event, stdName, parent.name, feedbackHtml),
      });
      await this.safeLog({ ...base, status: 'SENT', sentAt: new Date() });
      return { stdId, parId: parent.parId, status: 'SENT' };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(
        `feedback mail failed evt=${event.id} par=${parent.parId} err=${msg}`,
      );
      await this.safeLog({ ...base, status: 'FAILED', error: msg.slice(0, 500) });
      return { stdId, parId: parent.parId, status: 'FAILED', error: msg };
    }
  }

  /** 이력 기록 실패는 발송 결과를 오염시키지 않는다 (append-only 로그). */
  private async safeLog(
    input: Parameters<NotificationService['appendLog']>[0],
  ): Promise<void> {
    try {
      await this.notifications.appendLog(input);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`notification log write failed: ${msg}`);
    }
  }

  private async getEvent(
    entId: string,
    evtId: string,
  ): Promise<CalEventTypeormEntity> {
    const event = await this.events.findOne({
      where: { id: evtId, entId, deletedAt: IsNull() },
    });
    if (!event) throw new NotFoundException('EVENT_NOT_FOUND');
    return event;
  }

  private async resolveStudents(
    entId: string,
    evtId: string,
  ): Promise<FeedbackRecipientStudent[]> {
    const inviteeRows = await this.invitees.find({
      where: { entId, evtId, kind: 'STUDENT' },
    });
    const stdIds = Array.from(new Set(inviteeRows.map((r) => r.refId)));
    if (stdIds.length === 0) return [];

    const [studentRows, linkRows] = await Promise.all([
      this.students.find({
        where: { id: In(stdIds), entId, deletedAt: IsNull() },
      }),
      this.studentParents.find({ where: { entId, stdId: In(stdIds) } }),
    ]);

    const parIds = Array.from(new Set(linkRows.map((l) => l.parId)));
    const parentRows =
      parIds.length > 0
        ? await this.parents.find({
            where: { id: In(parIds), entId, deletedAt: IsNull() },
          })
        : [];
    const parentMap = new Map(parentRows.map((p) => [p.id, p]));

    return studentRows
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      .map((s) => {
        const parents = linkRows
          .filter((l) => l.stdId === s.id)
          .map((l) => {
            const p = parentMap.get(l.parId);
            if (!p) return null;
            return {
              parId: p.id,
              name: p.name,
              relation: p.relation ?? null,
              email: p.email?.trim() || null,
              isPrimary: l.isPrimary,
            };
          })
          .filter((p): p is FeedbackRecipientParent => p !== null)
          .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
        return { stdId: s.id, stdName: s.name, parents };
      });
  }

  private renderBody(
    event: CalEventTypeormEntity,
    stdName: string,
    parentName: string,
    feedbackHtml: string,
  ): string {
    const when = this.formatKst(event.startAt);
    return [
      `<div style="font-family:'Apple SD Gothic Neo',Pretendard,sans-serif;max-width:640px;margin:0 auto;color:#1f2937;">`,
      `<p>${this.escape(parentName)}님, 안녕하세요.</p>`,
      `<p>${this.escape(stdName)} 학생의 수업 피드백을 전달드립니다.</p>`,
      `<table style="border-collapse:collapse;margin:12px 0;font-size:14px;">`,
      `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;">수업</td><td>${this.escape(event.title)}</td></tr>`,
      `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;">일시</td><td>${this.escape(when)}</td></tr>`,
      `</table>`,
      `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:8px 0;">`,
      this.stripScripts(feedbackHtml),
      `</div>`,
      `<p style="color:#6b7280;font-size:12px;">본 메일은 학원에서 발송한 수업 피드백 안내입니다.</p>`,
      `</div>`,
    ].join('\n');
  }

  private formatKst(d: Date): string {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  }

  private escape(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 저장된 리치 HTML에서 script 계열만 제거(메일 클라이언트 방어). */
  private stripScripts(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }

  private htmlToSummary(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }
}
