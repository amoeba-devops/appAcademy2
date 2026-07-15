import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { ACM_DS } from '../../acm-common/datasource';
import {
  PortalAccountTypeormEntity,
  type PortalKind,
} from '../infrastructure/typeorm/portal-account.typeorm-entity';
import { AcmTenantTypeormEntity } from '../../acm-system/infrastructure/typeorm/acm-tenant.typeorm-entity';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { ParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { TeacherTypeormEntity } from '../../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import type { PortalAccountView } from './dto/portal-account.dto';

/**
 * PLN-260706 — portal login credentials for student / parent / teacher.
 *
 * Admin issues a system-generated login id + temporary password (forced
 * rotation on first login). The same table backs the unified portal login;
 * a portal JWT (kind + refId) drives role-scoped menus and "my events"
 * calendar filtering downstream.
 */
export interface PortalJwtPayload {
  sub: string; // pac_id
  entId: string;
  kind: PortalKind;
  refId: string;
  loginId: string;
  mustChangePassword: boolean;
}

export interface PortalAuthUser {
  id: string;
  entId: string;
  kind: PortalKind;
  refId: string;
  loginId: string;
  mustChangePassword: boolean;
}

// Login-id alphabet excludes ambiguous chars (no i/l/o/0/1).
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const ID_PREFIX: Record<PortalKind, string> = {
  STUDENT: 's',
  PARENT: 'p',
  TEACHER: 't',
};
// Temp-password alphabet (letters + digits, ambiguous chars removed).
const PW_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
const PW_DIGITS = '23456789';
const PW_ALL = PW_LETTERS + PW_DIGITS;

@Injectable()
export class PortalAccountService {
  private readonly log = new Logger(PortalAccountService.name);

  constructor(
    @InjectRepository(PortalAccountTypeormEntity, ACM_DS)
    private readonly repo: Repository<PortalAccountTypeormEntity>,
    @InjectRepository(AcmTenantTypeormEntity, ACM_DS)
    private readonly tenants: Repository<AcmTenantTypeormEntity>,
    @InjectRepository(StudentTypeormEntity, ACM_DS)
    private readonly students: Repository<StudentTypeormEntity>,
    @InjectRepository(ParentTypeormEntity, ACM_DS)
    private readonly parents: Repository<ParentTypeormEntity>,
    @InjectRepository(TeacherTypeormEntity, ACM_DS)
    private readonly teachers: Repository<TeacherTypeormEntity>,
    private readonly jwt: JwtService,
  ) {}

  // ---------------------------------------------------------------------------
  // Issuance (admin + auto-registration)
  // ---------------------------------------------------------------------------

  /**
   * Idempotent — create the account with a temp password if none exists for
   * (kind, refId); otherwise return the existing account with no password.
   * Used by the CLASS_STARTED auto-registration hook.
   */
  async ensureAccount(
    entId: string,
    kind: PortalKind,
    refId: string,
  ): Promise<{
    account: PortalAccountTypeormEntity | null;
    tempPassword?: string;
    created: boolean;
  }> {
    const existing = await this.repo.findOne({ where: { entId, kind, refId } });
    if (existing) return { account: existing, created: false };
    // PLN-260714 — STUDENT 로그인ID는 학생 이메일. 이메일이 없으면 자동발급을
    // 조용히 건너뛴다 (관리자가 이메일 입력 후 발급). 전환 흐름을 막지 않음.
    if (kind === 'STUDENT' && !(await this.studentEmail(entId, refId))) {
      this.log.log(`ensureAccount skipped — student ${refId} has no email`);
      return { account: null, created: false };
    }
    const { account, tempPassword } = await this.create(entId, kind, refId);
    return { account, tempPassword, created: true };
  }

  /** Admin explicit issue — 409 if an account already exists (use reset instead). */
  async issue(
    entId: string,
    kind: PortalKind,
    refId: string,
    password?: string,
  ): Promise<{ id: string; loginId: string; tempPassword: string }> {
    const existing = await this.repo.findOne({ where: { entId, kind, refId } });
    if (existing) {
      throw new HttpException(
        { code: 'PORTAL_ACCOUNT_EXISTS', message: 'Account already issued — use reset' },
        HttpStatus.CONFLICT,
      );
    }
    const { account, tempPassword } = await this.create(entId, kind, refId, password);
    return { id: account.id, loginId: account.loginId, tempPassword };
  }

  private async create(
    entId: string,
    kind: PortalKind,
    refId: string,
    password?: string,
  ): Promise<{ account: PortalAccountTypeormEntity; tempPassword: string }> {
    const loginId = await this.resolveLoginId(entId, kind, refId);
    // PLN-260716 — 관리자 지정 비번(있으면) 또는 자동생성. 강제 변경 없음(단순 로그인).
    const tempPassword = password && password.length > 0 ? password : generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const account = await this.repo.save(
      this.repo.create({
        entId,
        kind,
        refId,
        loginId,
        passwordHash,
        mustChangePassword: false,
        status: 'ACTIVE',
      }),
    );
    this.log.log(`portal account issued kind=${kind} ref=${refId} loginId=${loginId}`);
    return { account, tempPassword };
  }

  /**
   * Admin password reset. PLN-260716 — optional operator-set password; no forced
   * rotation (portal is a low-security schedule viewer). Clears lock.
   */
  async reissuePassword(
    entId: string,
    pacId: string,
    password?: string,
  ): Promise<{ id: string; loginId: string; tempPassword: string }> {
    const acc = await this.repo.findOne({ where: { id: pacId, entId } });
    if (!acc) {
      throw new HttpException({ code: 'PORTAL_ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    const tempPassword = password && password.length > 0 ? password : generateTempPassword();
    acc.passwordHash = await bcrypt.hash(tempPassword, 12);
    acc.mustChangePassword = false;
    acc.lockedAt = null;
    acc.updatedAt = new Date();
    await this.repo.save(acc);
    this.log.log(`portal account password reset loginId=${acc.loginId}`);
    return { id: acc.id, loginId: acc.loginId, tempPassword };
  }

  /**
   * PLN-260716 — reset the account's login id to the linked subject's email
   * (student/teacher/parent). Lowercased; 409 on collision, 422 if no email.
   */
  async resetLoginIdToEmail(
    entId: string,
    pacId: string,
  ): Promise<{ id: string; loginId: string }> {
    const acc = await this.repo.findOne({ where: { id: pacId, entId } });
    if (!acc) {
      throw new HttpException({ code: 'PORTAL_ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    const email = await this.subjectEmail(entId, acc.kind, acc.refId);
    if (!email) {
      throw new HttpException(
        { code: 'EMAIL_REQUIRED', message: '대상자 이메일이 없어 로그인ID로 설정할 수 없습니다.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const loginId = email.toLowerCase();
    if (loginId !== acc.loginId) {
      const clash = await this.repo.findOne({
        where: { entId, loginId },
        select: ['id'],
      });
      if (clash) {
        throw new HttpException(
          { code: 'LOGIN_ID_TAKEN', message: '이미 사용 중인 로그인ID(이메일)입니다.' },
          HttpStatus.CONFLICT,
        );
      }
      acc.loginId = loginId;
      acc.updatedAt = new Date();
      await this.repo.save(acc);
      this.log.log(`portal loginId reset to email kind=${acc.kind} ref=${acc.refId}`);
    }
    return { id: acc.id, loginId: acc.loginId };
  }

  async getByRef(
    entId: string,
    kind: PortalKind,
    refId: string,
  ): Promise<PortalAccountView | null> {
    const acc = await this.repo.findOne({ where: { entId, kind, refId } });
    return acc ? toView(acc) : null;
  }

  // ---------------------------------------------------------------------------
  // Portal login / self-service
  // ---------------------------------------------------------------------------

  /**
   * PLN-260708 — tenant-scoped portal login. Resolves the tenant by its login
   * code (slug), then matches (entId, loginId) so per-tenant-unique loginIds
   * don't collide across tenants. Unknown tenant code / loginId / password all
   * return the same 401 so tenant/account existence isn't disclosed.
   */
  async login(
    tenantCode: string,
    loginId: string,
    password: string,
  ): Promise<{ accessToken: string; mustChangePassword: boolean; user: PortalAuthUser }> {
    const entId = await this.resolveEntIdByCode(tenantCode);
    const acc = entId
      ? await this.repo.findOne({ where: { entId, loginId, status: 'ACTIVE' } })
      : null;
    const ok = !!acc && (await bcrypt.compare(password, acc.passwordHash));
    if (!acc || !ok) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }
    if (acc.lockedAt) {
      throw new HttpException(
        { code: 'ACCOUNT_LOCKED', message: '계정이 잠겼습니다. 학원에 문의하세요.' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    acc.lastLoginAt = new Date();
    await this.repo.update(acc.id, { lastLoginAt: acc.lastLoginAt });
    return {
      accessToken: this.sign(acc),
      mustChangePassword: acc.mustChangePassword,
      user: toAuthUser(acc),
    };
  }

  /** Self-service change (verifies current, clears rotation requirement). */
  async changePassword(
    pacId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const acc = await this.repo.findOne({ where: { id: pacId } });
    if (!acc) {
      throw new HttpException({ code: 'PORTAL_ACCOUNT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    const ok = await bcrypt.compare(currentPassword, acc.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('CURRENT_PASSWORD_INVALID');
    }
    assertPasswordPolicy(newPassword);
    acc.passwordHash = await bcrypt.hash(newPassword, 12);
    acc.mustChangePassword = false;
    await this.repo.save(acc);
  }

  /** For the portal JWT strategy — re-check ACTIVE on every request. */
  async findActiveById(id: string, entId: string): Promise<PortalAuthUser | null> {
    const acc = await this.repo.findOne({ where: { id, entId, status: 'ACTIVE' } });
    return acc ? toAuthUser(acc) : null;
  }

  // ---------------------------------------------------------------------------

  /** Resolve an ACTIVE tenant's entId from its login code (slug). */
  private async resolveEntIdByCode(tenantCode: string): Promise<string | null> {
    const code = (tenantCode ?? '').trim().toLowerCase();
    if (!code) return null;
    const t = await this.tenants.findOne({
      where: { code, status: 'ACTIVE' },
      select: ['entId'],
    });
    return t?.entId ?? null;
  }

  private sign(acc: PortalAccountTypeormEntity): string {
    const payload: PortalJwtPayload = {
      sub: acc.id,
      entId: acc.entId,
      kind: acc.kind,
      refId: acc.refId,
      loginId: acc.loginId,
      mustChangePassword: acc.mustChangePassword,
    };
    return this.jwt.sign(payload);
  }

  /** Look up an active student's trimmed email, or null when absent. */
  private async studentEmail(entId: string, refId: string): Promise<string | null> {
    const s = await this.students.findOne({
      where: { id: refId, entId },
      select: { id: true, email: true },
    });
    return s?.email?.trim() || null;
  }

  /** PLN-260716 — linked subject email by kind (student/teacher/parent). */
  private async subjectEmail(
    entId: string,
    kind: PortalKind,
    refId: string,
  ): Promise<string | null> {
    if (kind === 'STUDENT') return this.studentEmail(entId, refId);
    if (kind === 'TEACHER') {
      const tch = await this.teachers.findOne({
        where: { id: refId, entId },
        select: { id: true, email: true },
      });
      return tch?.email?.trim() || null;
    }
    const par = await this.parents.findOne({
      where: { id: refId, entId },
      select: { id: true, email: true },
    });
    return par?.email?.trim() || null;
  }

  /**
   * PLN-260714 — STUDENT 포털계정 로그인ID = 학생 이메일(소문자). 이메일이 없으면
   * 422, 동일 테넌트에 이미 쓰인 로그인ID면 409. STUDENT 외 종류는 기존
   * 시스템 생성 로그인ID 를 사용한다.
   */
  private async resolveLoginId(
    entId: string,
    kind: PortalKind,
    refId: string,
  ): Promise<string> {
    if (kind !== 'STUDENT') return this.generateUniqueLoginId(entId, kind);

    const email = await this.studentEmail(entId, refId);
    if (!email) {
      throw new HttpException(
        {
          code: 'STUDENT_EMAIL_REQUIRED',
          message: '학생 이메일 등록 후 포털계정을 발급할 수 있습니다.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const loginId = email.toLowerCase();
    const clash = await this.repo.findOne({
      where: { entId, loginId },
      select: ['id'],
    });
    if (clash) {
      throw new HttpException(
        { code: 'LOGIN_ID_TAKEN', message: '이미 사용 중인 로그인ID(이메일)입니다.' },
        HttpStatus.CONFLICT,
      );
    }
    return loginId;
  }

  private async generateUniqueLoginId(
    entId: string,
    kind: PortalKind,
  ): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const candidate = ID_PREFIX[kind] + randomString(ID_ALPHABET, 6);
      const clash = await this.repo.findOne({
        where: { entId, loginId: candidate },
        select: ['id'],
      });
      if (!clash) return candidate;
    }
    throw new HttpException(
      { code: 'LOGIN_ID_GENERATION_FAILED' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function toAuthUser(a: PortalAccountTypeormEntity): PortalAuthUser {
  return {
    id: a.id,
    entId: a.entId,
    kind: a.kind,
    refId: a.refId,
    loginId: a.loginId,
    mustChangePassword: a.mustChangePassword,
  };
}

function toView(a: PortalAccountTypeormEntity): PortalAccountView {
  return {
    id: a.id,
    kind: a.kind,
    refId: a.refId,
    loginId: a.loginId,
    status: a.status,
    mustChangePassword: a.mustChangePassword,
    lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
    lockedAt: a.lockedAt ? a.lockedAt.toISOString() : null,
  };
}

function randomString(alphabet: string, len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/** 10-char temp password guaranteed to satisfy the letter+digit policy. */
function generateTempPassword(): string {
  const chars = [
    PW_LETTERS[randomInt(PW_LETTERS.length)],
    PW_DIGITS[randomInt(PW_DIGITS.length)],
  ];
  for (let i = 0; i < 8; i++) chars.push(PW_ALL[randomInt(PW_ALL.length)]);
  // Fisher-Yates shuffle so the guaranteed letter/digit aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function assertPasswordPolicy(pw: string): void {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 120) {
    throw new HttpException(
      { code: 'PASSWORD_LENGTH', message: 'Password must be 8-120 chars' },
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    throw new HttpException(
      { code: 'PASSWORD_COMPLEXITY', message: 'Password must contain letters and digits' },
      HttpStatus.BAD_REQUEST,
    );
  }
}
