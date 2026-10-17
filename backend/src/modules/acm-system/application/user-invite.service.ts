import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { AcmAuthService } from '../../acm-auth/application/acm-auth.service';
import { TenantMailerService } from './tenant-mailer.service';

export const INVITE_ROLES = ['ADMIN', 'STAFF'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];
const INVITE_HOURS = 72;

export interface InviteSendResult {
  id: string;
  mailSent: boolean;
  expiresAt: string;
  /** 메일을 보내지 못했을 때만 — 운영자 화면에 한 번만 표시 */
  inviteUrl?: string;
}

interface InviteRow {
  inv_id: string;
  ent_id: string;
  inv_email: string;
  inv_name: string;
  inv_role: InviteRole;
  inv_grant_config_admin: boolean;
  inv_status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  inv_expires_at: Date;
}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/**
 * REQ-261018 — 서비스 운영자가 같은 테넌트에 관리자·직원을 초대한다.
 * 초대 링크는 72시간·1회용이고 토큰은 해시로만 저장한다. 테넌트 마스터 권한은 초대로 줄 수 없다.
 */
@Injectable()
export class UserInviteService {
  private readonly logger = new Logger(UserInviteService.name);

  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly auth: AcmAuthService,
    private readonly mailer: TenantMailerService,
    private readonly config: ConfigService,
  ) {}

  list(u: AcmCurrentUser, status?: string) {
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT i.inv_id, i.inv_email, i.inv_name, i.inv_role, i.inv_grant_config_admin,
              CASE WHEN i.inv_status = 'PENDING' AND i.inv_expires_at < now() THEN 'EXPIRED' ELSE i.inv_status END AS inv_status,
              i.inv_expires_at, i.inv_mail_sent, i.accepted_at, i.created_at, b.usr_name AS invited_by_name
         FROM amb_acm_user_invite i
         LEFT JOIN amb_acm_user b ON b.ent_id = i.ent_id AND b.usr_id = i.invited_by
        WHERE i.ent_id = $1
          AND ($2::text IS NULL
               OR ($2 = 'EXPIRED' AND i.inv_status = 'PENDING' AND i.inv_expires_at < now())
               OR ($2 = 'PENDING' AND i.inv_status = 'PENDING' AND i.inv_expires_at >= now())
               OR ($2 NOT IN ('PENDING','EXPIRED') AND i.inv_status = $2))
        ORDER BY i.created_at DESC
        LIMIT 200`,
      [u.entId, status ?? null],
    );
  }

  async create(
    u: AcmCurrentUser,
    dto: {
      email: string;
      name: string;
      role: InviteRole;
      grantConfigAdmin?: boolean;
    },
  ): Promise<InviteSendResult> {
    const email = dto.email.trim().toLowerCase();
    // 로그인은 이메일로 전 테넌트를 찾으므로 어느 테넌트든 이미 있으면 초대하지 않는다.
    const [exists] = await this.ds.query<{ n: number }[]>(
      `SELECT count(*)::int n FROM amb_acm_user WHERE lower(usr_email) = $1`,
      [email],
    );
    if (exists.n > 0)
      throw new ConflictException({
        code: 'INVITE_USER_EXISTS',
        message: '이미 가입된 이메일입니다.',
      });
    // 같은 이메일의 이전 대기 초대(만료 포함)는 취소하고 새로 보낸다.
    await this.ds.query(
      `UPDATE amb_acm_user_invite SET inv_status = 'REVOKED'
        WHERE ent_id = $1 AND lower(inv_email) = $2 AND inv_status = 'PENDING'`,
      [u.entId, email],
    );
    const token = randomBytes(32).toString('base64url');
    const [row] = await this.ds.query<
      { inv_id: string; inv_expires_at: Date }[]
    >(
      `INSERT INTO amb_acm_user_invite
         (ent_id, inv_email, inv_name, inv_role, inv_grant_config_admin, inv_token_hash, inv_expires_at, invited_by)
       VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(hours => $7), $8)
       RETURNING inv_id, inv_expires_at`,
      [
        u.entId,
        email,
        dto.name.trim(),
        dto.role,
        dto.grantConfigAdmin === true,
        hashToken(token),
        INVITE_HOURS,
        u.id,
      ],
    );
    return this.send(
      u,
      row.inv_id,
      email,
      dto.name.trim(),
      dto.role,
      token,
      row.inv_expires_at,
    );
  }

  /** 재발송: 새 토큰·새 72시간(이전 링크는 무효). */
  async resend(u: AcmCurrentUser, id: string): Promise<InviteSendResult> {
    const inv = await this.pending(u.entId, id);
    const token = randomBytes(32).toString('base64url');
    // UPDATE … RETURNING 은 TypeORM 에서 [rows, count] 로 돌아온다.
    const [[row]] = await this.ds.query<[{ inv_expires_at: Date }[], number]>(
      `UPDATE amb_acm_user_invite
          SET inv_token_hash = $3, inv_expires_at = now() + make_interval(hours => $4)
        WHERE ent_id = $1 AND inv_id = $2 RETURNING inv_expires_at`,
      [u.entId, id, hashToken(token), INVITE_HOURS],
    );
    return this.send(
      u,
      id,
      inv.inv_email,
      inv.inv_name,
      inv.inv_role,
      token,
      row.inv_expires_at,
    );
  }

  async revoke(u: AcmCurrentUser, id: string) {
    await this.pending(u.entId, id);
    await this.ds.query(
      `UPDATE amb_acm_user_invite SET inv_status = 'REVOKED' WHERE ent_id = $1 AND inv_id = $2`,
      [u.entId, id],
    );
    return { ok: true };
  }

  /** 공개: 초대 정보(수락 화면 표시용). */
  async describe(token: string) {
    const inv = await this.byToken(token);
    const [t] = await this.ds.query<{ tnt_name: string }[]>(
      `SELECT tnt_name FROM amb_acm_tenant WHERE tnt_ent_id = $1`,
      [inv.ent_id],
    );
    return {
      email: inv.inv_email,
      name: inv.inv_name,
      role: inv.inv_role,
      tenantName: t?.tnt_name ?? null,
      expiresAt: new Date(inv.inv_expires_at).toISOString(),
    };
  }

  /** 공개: 비밀번호를 정해 가입하고 바로 로그인한다. */
  async accept(token: string, password: string) {
    const inv = await this.byToken(token);
    const { id } = await this.auth.createUserWithPassword({
      entId: inv.ent_id,
      email: inv.inv_email,
      plainPassword: password,
      name: inv.inv_name,
      role: inv.inv_role,
    });
    if (inv.inv_grant_config_admin)
      await this.ds.query(
        `INSERT INTO amb_acm_user_permission (ent_id, usr_id, upr_permission)
         VALUES ($1, $2, 'CONFIG_ADMIN') ON CONFLICT DO NOTHING`,
        [inv.ent_id, id],
      );
    await this.ds.query(
      `UPDATE amb_acm_user_invite
          SET inv_status = 'ACCEPTED', accepted_usr_id = $2, accepted_at = now()
        WHERE inv_id = $1`,
      [inv.inv_id, id],
    );
    this.logger.log(`invite accepted inv=${inv.inv_id} user=${id}`);
    return this.auth.login(inv.inv_email, password);
  }

  private async pending(entId: string, id: string) {
    const [inv] = await this.ds.query<InviteRow[]>(
      `SELECT * FROM amb_acm_user_invite WHERE ent_id = $1 AND inv_id = $2`,
      [entId, id],
    );
    if (!inv) throw new NotFoundException();
    if (inv.inv_status !== 'PENDING')
      throw new BadRequestException({
        code: 'INVITE_HANDLED',
        message: '이미 처리된 초대입니다.',
      });
    return inv;
  }

  private async byToken(token: string) {
    const [inv] = await this.ds.query<InviteRow[]>(
      `SELECT * FROM amb_acm_user_invite WHERE inv_token_hash = $1`,
      [hashToken(token)],
    );
    if (
      !inv ||
      inv.inv_status !== 'PENDING' ||
      new Date(inv.inv_expires_at).getTime() < Date.now()
    )
      throw new GoneException({
        code: 'INVITE_INVALID',
        message: '초대 링크가 만료되었거나 이미 사용되었습니다.',
      });
    return inv;
  }

  private async send(
    u: AcmCurrentUser,
    id: string,
    email: string,
    name: string,
    role: InviteRole,
    token: string,
    expiresAt: Date,
  ): Promise<InviteSendResult> {
    const base = (
      this.config.get<string>('ACM_PUBLIC_URL') ??
      this.config.get<string>('FRONTEND_URL') ??
      ''
    ).replace(/\/$/, '');
    const url = `${base}/invite?token=${token}`;
    let mailSent = false;
    try {
      if (await this.mailer.isConfigured(u.entId)) {
        await this.mailer.send(
          u.entId,
          this.mail(email, name, role, url, expiresAt),
        );
        mailSent = true;
      }
    } catch (e) {
      // 링크(토큰)는 로그하지 않는다
      this.logger.warn(
        `invite mail failed inv=${id} reason=${(e as Error).message}`,
      );
    }
    await this.ds.query(
      `UPDATE amb_acm_user_invite SET inv_mail_sent = $2 WHERE inv_id = $1`,
      [id, mailSent],
    );
    this.logger.log(`invite sent inv=${id} by=${u.id} mail=${mailSent}`);
    return {
      id,
      mailSent,
      expiresAt: new Date(expiresAt).toISOString(),
      ...(mailSent ? {} : { inviteUrl: url }),
    };
  }

  private mail(
    email: string,
    name: string,
    role: InviteRole,
    url: string,
    expiresAt: Date,
  ) {
    const until = new Date(expiresAt)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 16);
    const roleKo = role === 'ADMIN' ? '관리자' : '직원';
    const roleEn = role === 'ADMIN' ? 'administrator' : 'staff';
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
      `${name}님, ACM ${roleKo} 계정에 초대되었습니다.`,
      `아래 링크에서 비밀번호를 정하면 가입이 완료됩니다(${until} UTC 까지, 1회용).`,
      url,
      '',
      `You have been invited to ACM as ${roleEn}. Set your password here (valid until ${until} UTC, single use): ${url}`,
    ].join('\n');
    const html = `<p>${esc(name)}님, ACM ${roleKo} 계정에 초대되었습니다.</p>
<p><a href="${esc(url)}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none">가입하고 시작하기 / Accept invitation</a></p>
<p>유효기간: ${until} (UTC)까지 · 1회용</p>
<hr><p style="color:#666">You have been invited to ACM as ${roleEn}. The link is valid until ${until} UTC and can be used once.</p>`;
    return { to: email, subject: '[ACM] 초대 안내 / Invitation', text, html };
  }
}
