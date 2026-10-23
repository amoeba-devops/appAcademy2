import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { AcmAuthService } from '../../acm-auth/application/acm-auth.service';
import {
  PasswordResetService,
  type IssueResult,
} from './password-reset.service';

export interface AdminUserView {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'STAFF';
  status: string;
  authSource: 'ama' | 'local';
  localPinned: boolean;
  hasPassword: boolean;
  mustChangePassword: boolean;
  lockedAt: string | null;
  amaRole: string | null;
  permissions: string[];
  isTenantMaster: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

const SELECT = `
  SELECT u.usr_id::text id, u.usr_email email, u.usr_name name, u.usr_role role, u.usr_status status,
         CASE WHEN u.auth_source='ama' THEN 'ama' ELSE 'local' END "authSource", u.usr_local_pinned "localPinned",
         (u.usr_password_hash IS NOT NULL) "hasPassword", u.usr_must_change_password "mustChangePassword",
         u.usr_locked_at::text "lockedAt", u.ama_role "amaRole",
         COALESCE((SELECT array_agg(p.upr_permission ORDER BY p.upr_permission) FROM amb_acm_user_permission p
                    WHERE p.ent_id=u.ent_id AND p.usr_id=u.usr_id), '{}') permissions,
         EXISTS (SELECT 1 FROM amb_acm_user_permission p WHERE p.ent_id=u.ent_id AND p.usr_id=u.usr_id AND p.upr_permission='TENANT_MASTER') "isTenantMaster",
         u.created_at::text "createdAt", u.usr_last_login_at::text "lastLoginAt"
    FROM amb_acm_user u
   WHERE u.ent_id=$1 AND u.usr_role IN ('ADMIN','STAFF')`;

/**
 * REQ-261024 — 서비스 설정 > 관리자 관리: this tenant's ADMIN/STAFF console accounts.
 * Edit, lock, set/issue passwords, switch AMA → local (pinned so SSO keeps it local).
 */
@Injectable()
export class AdminUserService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly auth: AcmAuthService,
    private readonly resets: PasswordResetService,
  ) {}

  list(
    entId: string,
    f: { q?: string; role?: string; auth?: string },
  ): Promise<AdminUserView[]> {
    const params: unknown[] = [entId];
    const cond: string[] = [];
    if (f.q?.trim()) {
      params.push(`%${f.q.trim().replace(/[%_\\]/g, '\\$&')}%`);
      cond.push(
        `(u.usr_name ILIKE $${params.length} OR u.usr_email ILIKE $${params.length})`,
      );
    }
    if (f.role === 'ADMIN' || f.role === 'STAFF') {
      params.push(f.role);
      cond.push(`u.usr_role = $${params.length}`);
    }
    if (f.auth === 'ama') cond.push(`u.auth_source = 'ama'`);
    else if (f.auth === 'local') cond.push(`u.auth_source <> 'ama'`);
    return this.ds.query<AdminUserView[]>(
      `${SELECT}${cond.length ? ` AND ${cond.join(' AND ')}` : ''} ORDER BY u.usr_status, u.usr_role, u.usr_name`,
      params,
    );
  }

  async get(entId: string, id: string): Promise<AdminUserView> {
    const [row] = await this.ds.query<AdminUserView[]>(
      `${SELECT} AND u.usr_id=$2`,
      [entId, id],
    );
    if (!row) throw new NotFoundException('USER_NOT_FOUND');
    return row;
  }

  async update(
    actor: AcmCurrentUser,
    id: string,
    dto: {
      name?: string;
      email?: string;
      role?: 'ADMIN' | 'STAFF';
      status?: 'ACTIVE' | 'INACTIVE';
    },
  ): Promise<AdminUserView> {
    const cur = await this.get(actor.entId, id);
    const self = actor.id === id;
    // FR-A7 — never lock yourself out; the tenant master's grade is fixed here.
    if (self && dto.role && dto.role !== cur.role)
      throw new ForbiddenException('CANNOT_CHANGE_OWN_ROLE');
    if (self && dto.status && dto.status !== 'ACTIVE')
      throw new ForbiddenException('CANNOT_DEACTIVATE_SELF');
    if (cur.isTenantMaster && dto.role && dto.role !== cur.role)
      throw new ForbiddenException('TENANT_MASTER_ROLE_FIXED');
    if (cur.isTenantMaster && dto.status && dto.status !== 'ACTIVE')
      throw new ForbiddenException('TENANT_MASTER_ROLE_FIXED');
    const sets: string[] = [];
    const params: unknown[] = [actor.entId, id];
    const set = (col: string, v: unknown) => {
      params.push(v);
      sets.push(`${col}=$${params.length}`);
    };
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('NAME_REQUIRED');
      set('usr_name', name.slice(0, 100));
    }
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== cur.email.toLowerCase()) {
        const [dup] = await this.ds.query(
          `SELECT 1 FROM amb_acm_user WHERE lower(usr_email)=$1 AND usr_id<>$2`,
          [email, id],
        );
        if (dup)
          throw new ConflictException({
            code: 'EMAIL_TAKEN',
            message: 'EMAIL_TAKEN',
          });
        set('usr_email', email);
      }
    }
    if (dto.role !== undefined) set('usr_role', dto.role);
    if (dto.status !== undefined) set('usr_status', dto.status);
    if (sets.length)
      await this.ds.query(
        `UPDATE amb_acm_user SET ${sets.join(', ')}, updated_at=now() WHERE ent_id=$1 AND usr_id=$2`,
        params,
      );
    return this.get(actor.entId, id);
  }

  async lock(
    actor: AcmCurrentUser,
    id: string,
    locked: boolean,
  ): Promise<AdminUserView> {
    const cur = await this.get(actor.entId, id);
    if (locked && actor.id === id)
      throw new ForbiddenException('CANNOT_LOCK_SELF');
    if (locked && cur.isTenantMaster)
      throw new ForbiddenException('TENANT_MASTER_ROLE_FIXED');
    if (locked) await this.auth.lockUser(id, actor.id);
    else await this.auth.unlockUser(id, actor.id);
    return this.get(actor.entId, id);
  }

  async setPassword(
    actor: AcmCurrentUser,
    id: string,
    password: string,
    mustChange: boolean,
  ): Promise<AdminUserView> {
    await this.get(actor.entId, id);
    await this.auth.setPasswordByAdmin(id, password, mustChange, actor.id);
    return this.get(actor.entId, id);
  }

  async issueTemp(actor: AcmCurrentUser, id: string): Promise<IssueResult> {
    await this.get(actor.entId, id);
    return this.resets.issueForUser(actor, id);
  }

  /** FR-A5 — AMA → local (pinned). Accounts without a password get a temporary one (mail or shown once). */
  async switchLocal(actor: AcmCurrentUser, ids: string[]) {
    const out: Array<{
      id: string;
      email: string;
      switched: boolean;
      temp?: IssueResult;
      error?: string;
    }> = [];
    for (const id of [...new Set(ids)]) {
      const cur = await this.get(actor.entId, id).catch(() => null);
      if (!cur) {
        out.push({ id, email: '', switched: false, error: 'USER_NOT_FOUND' });
        continue;
      }
      await this.ds.query(
        `UPDATE amb_acm_user SET auth_source='local', usr_local_pinned=true, updated_at=now() WHERE ent_id=$1 AND usr_id=$2`,
        [actor.entId, id],
      );
      let temp: IssueResult | undefined;
      let error: string | undefined;
      if (!cur.hasPassword && cur.status === 'ACTIVE') {
        try {
          temp = await this.resets.issueForUser(actor, id);
        } catch (e) {
          error = e instanceof Error ? e.message : 'TEMP_PASSWORD_FAILED';
        }
      }
      out.push({
        id,
        email: cur.email,
        switched: true,
        ...(temp ? { temp } : {}),
        ...(error ? { error } : {}),
      });
    }
    return { results: out };
  }
}
