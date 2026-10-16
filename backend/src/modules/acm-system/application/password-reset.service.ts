import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { AcmAuthService } from '../../acm-auth/application/acm-auth.service';
import { enqueueInbox } from '../../acm-notification/application/inbox-outbox';
import { TenantMailerService } from './tenant-mailer.service';

/** 같은 계정의 재요청 간격(초). 그 안의 요청은 조용히 무시한다. */
const REQUEST_COOLDOWN_SEC = 600;
const TEMP_PASSWORD_HOURS = 24;

export interface IssueResult {
  mailSent: boolean;
  expiresAt: string;
  /** 메일을 보내지 못했을 때만 — 관리자 화면에 한 번만 표시 */
  tempPassword?: string;
}

const isAdmin = (u: AcmCurrentUser) =>
  u.role === 'ADMIN' || u.role === 'APP_ADMIN';

/**
 * REQ-261017 — 비밀번호 재발급 요청 → 테넌트 관리자 처리 → 임시 비밀번호 메일 발송.
 * 요청 응답은 계정 존재 여부와 관계없이 같다(계정 확인용 악용 방지).
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly auth: AcmAuthService,
    private readonly mailer: TenantMailerService,
    private readonly config: ConfigService,
  ) {}

  /** 공개: 이메일로 재발급 요청. 존재하지 않아도 같은 응답. */
  async request(email: string, ip?: string): Promise<{ ok: true }> {
    const normalized = email.trim().toLowerCase();
    const users = await this.ds.query<{ usr_id: string; ent_id: string }[]>(
      `SELECT usr_id, ent_id FROM amb_acm_user WHERE lower(usr_email) = $1 AND usr_status = 'ACTIVE'`,
      [normalized],
    );
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex') : null;
    for (const u of users) {
      await this.ds.transaction(async (m) => {
        const [pending] = await m.query<{ prr_id: string; recent: boolean }[]>(
          `SELECT prr_id, prr_requested_at > now() - make_interval(secs => $3) AS recent
             FROM amb_acm_password_reset_request
            WHERE ent_id = $1 AND usr_id = $2 AND prr_status = 'REQUESTED'`,
          [u.ent_id, u.usr_id, REQUEST_COOLDOWN_SEC],
        );
        if (pending?.recent) return;
        const [row] = pending
          ? await m.query<{ prr_id: string }[]>(
              `UPDATE amb_acm_password_reset_request SET prr_requested_at = now(), prr_ip_hash = $2
                WHERE prr_id = $1 RETURNING prr_id`,
              [pending.prr_id, ipHash],
            )
          : await m.query<{ prr_id: string }[]>(
              `INSERT INTO amb_acm_password_reset_request (ent_id, usr_id, prr_ip_hash)
               VALUES ($1, $2, $3) RETURNING prr_id`,
              [u.ent_id, u.usr_id, ipHash],
            );
        await enqueueInbox(m, {
          entId: u.ent_id,
          actorId: u.usr_id,
          type: 'PASSWORD_RESET_REQUEST',
          targetId: row.prr_id,
          payload: { title: normalized },
        });
      });
    }
    return { ok: true };
  }

  /** 관리자: 자기 테넌트 요청 목록(APP_ADMIN 도 현재 테넌트 기준). */
  async list(u: AcmCurrentUser, status?: string) {
    if (!isAdmin(u)) throw new ForbiddenException();
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT r.prr_id, r.usr_id, r.prr_status, r.prr_requested_at, r.prr_mail_sent, r.handled_at,
              u.usr_name, u.usr_email, u.usr_role, u.auth_source, h.usr_name AS handled_by_name
         FROM amb_acm_password_reset_request r
         JOIN amb_acm_user u ON u.ent_id = r.ent_id AND u.usr_id = r.usr_id
         LEFT JOIN amb_acm_user h ON h.ent_id = r.ent_id AND h.usr_id = r.handled_by
        WHERE r.ent_id = $1 AND ($2::text IS NULL OR r.prr_status = $2)
        ORDER BY (r.prr_status = 'REQUESTED') DESC, r.prr_requested_at DESC
        LIMIT 200`,
      [u.entId, status ?? null],
    );
  }

  private async pending(u: AcmCurrentUser, id: string) {
    if (!isAdmin(u)) throw new ForbiddenException();
    const [r] = await this.ds.query<
      { prr_id: string; usr_id: string; prr_status: string }[]
    >(
      `SELECT prr_id, usr_id, prr_status FROM amb_acm_password_reset_request WHERE ent_id = $1 AND prr_id = $2`,
      [u.entId, id],
    );
    if (!r) throw new NotFoundException();
    if (r.prr_status !== 'REQUESTED')
      throw new BadRequestException({
        code: 'RESET_REQUEST_HANDLED',
        message: '이미 처리된 요청입니다.',
      });
    return r;
  }

  /** 요청 처리: 임시 비밀번호 발급 + 메일. */
  async issueForRequest(u: AcmCurrentUser, id: string): Promise<IssueResult> {
    const r = await this.pending(u, id);
    const result = await this.issue(u, r.usr_id, u.entId);
    await this.ds.query(
      `UPDATE amb_acm_password_reset_request SET prr_status = 'ISSUED', handled_by = $3, handled_at = now(), prr_mail_sent = $4
        WHERE ent_id = $1 AND prr_id = $2`,
      [u.entId, id, u.id, result.mailSent],
    );
    return result;
  }

  async reject(u: AcmCurrentUser, id: string) {
    await this.pending(u, id);
    await this.ds.query(
      `UPDATE amb_acm_password_reset_request SET prr_status = 'REJECTED', handled_by = $3, handled_at = now()
        WHERE ent_id = $1 AND prr_id = $2`,
      [u.entId, id, u.id],
    );
    return { ok: true };
  }

  /**
   * 관리자 직접 발급(교사·직원 화면, 시스템 사용자). 테넌트 ADMIN 은 자기 테넌트만,
   * APP_ADMIN 은 모든 테넌트. 같은 사용자의 대기 요청은 함께 처리 완료로 바꾼다.
   */
  async issueForUser(u: AcmCurrentUser, userId: string): Promise<IssueResult> {
    if (!isAdmin(u)) throw new ForbiddenException();
    const [target] = await this.ds.query<{ ent_id: string }[]>(
      `SELECT ent_id FROM amb_acm_user WHERE usr_id = $1`,
      [userId],
    );
    if (!target || (u.role !== 'APP_ADMIN' && target.ent_id !== u.entId))
      throw new NotFoundException();
    const result = await this.issue(u, userId, target.ent_id);
    await this.ds.query(
      `UPDATE amb_acm_password_reset_request SET prr_status = 'ISSUED', handled_by = $3, handled_at = now(), prr_mail_sent = $4
        WHERE ent_id = $1 AND usr_id = $2 AND prr_status = 'REQUESTED'`,
      [target.ent_id, userId, u.id, result.mailSent],
    );
    return result;
  }

  private async issue(
    u: AcmCurrentUser,
    userId: string,
    entId: string,
  ): Promise<IssueResult> {
    const [user] = await this.ds.query<
      { usr_email: string; usr_name: string; usr_status: string }[]
    >(
      `SELECT usr_email, usr_name, usr_status FROM amb_acm_user WHERE ent_id = $1 AND usr_id = $2`,
      [entId, userId],
    );
    if (!user) throw new NotFoundException();
    if (user.usr_status !== 'ACTIVE')
      throw new BadRequestException({
        code: 'USER_INACTIVE',
        message: '비활성 계정에는 발급할 수 없습니다.',
      });
    const { password, expiresAt } = await this.auth.issueTempPassword(
      userId,
      TEMP_PASSWORD_HOURS,
    );
    let mailSent = false;
    try {
      if (await this.mailer.isConfigured(entId)) {
        await this.mailer.send(entId, this.mail(user, password, expiresAt));
        mailSent = true;
      }
    } catch (e) {
      // 비밀번호는 로그하지 않는다
      this.logger.warn(
        `temp password mail failed user=${userId} reason=${(e as Error).message}`,
      );
    }
    this.logger.log(
      `temp password issued user=${userId} by=${u.id} mail=${mailSent}`,
    );
    return {
      mailSent,
      expiresAt: expiresAt.toISOString(),
      ...(mailSent ? {} : { tempPassword: password }),
    };
  }

  private mail(
    user: { usr_email: string; usr_name: string },
    password: string,
    expiresAt: Date,
  ) {
    const base = (
      this.config.get<string>('ACM_PUBLIC_URL') ??
      this.config.get<string>('FRONTEND_URL') ??
      ''
    ).replace(/\/$/, '');
    const url = `${base}/admin/login`;
    const until = expiresAt.toISOString().replace('T', ' ').slice(0, 16);
    const esc = (v: string) =>
      v.replace(
        /[&<>"']/g,
        (c) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          })[c] as string,
      );
    const text = [
      `${user.usr_name}님, ACM 임시 비밀번호가 발급되었습니다.`,
      `임시 비밀번호: ${password}`,
      `유효기간: ${until} (UTC)까지 · 로그인 후 새 비밀번호로 바꿔야 합니다.`,
      `로그인: ${url}`,
      '',
      `Your temporary ACM password: ${password} (valid until ${until} UTC). You must set a new password after signing in: ${url}`,
    ].join('\n');
    const html = `<p>${esc(user.usr_name)}님, ACM 임시 비밀번호가 발급되었습니다.</p>
<p style="font-size:18px"><b>${esc(password)}</b></p>
<p>유효기간: ${until} (UTC)까지 · 로그인 후 새 비밀번호로 바꿔야 합니다.<br><a href="${esc(url)}">${esc(url)}</a></p>
<hr><p style="color:#666">Your temporary ACM password (valid until ${until} UTC). You must set a new password after signing in.</p>`;
    return {
      to: user.usr_email,
      subject: '[ACM] 임시 비밀번호 안내 / Temporary password',
      text,
      html,
    };
  }
}
