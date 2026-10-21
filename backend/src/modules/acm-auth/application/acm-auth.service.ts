import { sessionSignOptions } from '../../acm-common/session/session-client';
import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmUserTypeormEntity } from '../infrastructure/typeorm/acm-user.typeorm-entity';
import {
  AmaTokenVerifier,
  AmaTokenVerifyException,
  type AmaTokenPayload,
} from '../infrastructure/ama-token.verifier';
import { AmaSessionExchanger } from '../infrastructure/ama-session.exchanger';
import { AmaCustomAppVerifier } from '../infrastructure/ama-custom-app.verifier';
import {
  AmaOAuthRejectedException,
  AmaOAuthUnavailableException,
} from '../infrastructure/ama-oauth.client';
import { AcmAuthUser, AcmLoginResponse } from './dto/acm-auth.dto';
import { SubscriptionCheckService } from './subscription-check.service';
import { UserMembershipGuard } from './user-membership.guard';
import { AmaConfigGateService } from './ama-config-gate.service';
import { mapAcmRole, type AcmRole } from './acm-role.mapper';
import { generateTempPassword } from './temp-password';
import { isPublicSeedHash } from './public-seed-password';
import { AccessLogService } from '../../acm-aud/application/access-log.service';
import {
  LoginGuardService,
  consoleAccountKey,
  tooMany,
} from '../../acm-aud/application/login-guard.service';
import {
  AUD_SYSTEM_ENT,
  maskLoginId,
  type AccessActor,
  type AccessReason,
} from '../../acm-aud/application/aud.types';

/** REQ-260609C/D — AMA token verification mode. */
type AmaVerifyMode = 'local' | 'ama_session' | 'local_config';

export interface AcmJwtPayload {
  sub: string;
  entId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'TEACHER' | 'STAFF' | 'APP_ADMIN';
}


@Injectable()
export class AcmAuthService {
  private readonly logger = new Logger(AcmAuthService.name);
  private readonly verifyMode: AmaVerifyMode;
  /** REQ-261017B — 운영 모드에서는 공개 시드 비밀번호 로그인을 막는다. */
  private readonly isProduction: boolean;

  constructor(
    @InjectRepository(AcmUserTypeormEntity, ACM_DS)
    private readonly userRepo: Repository<AcmUserTypeormEntity>,
    private readonly jwtService: JwtService,
    private readonly amaVerifier: AmaTokenVerifier,
    private readonly subscriptionCheck: SubscriptionCheckService,
    private readonly membershipGuard: UserMembershipGuard,
    private readonly amaConfigGate: AmaConfigGateService,
    private readonly sessionExchanger: AmaSessionExchanger,
    private readonly customAppVerifier: AmaCustomAppVerifier,
    // REQ-261021B — 접속 로그 · DB 기반 로그인 실패 잠금
    private readonly accessLog: AccessLogService,
    private readonly loginGuard: LoginGuardService,
    config: ConfigService,
  ) {
    const mode = String(
      config.get('AMA_TOKEN_VERIFY_MODE', 'local'),
    ).toLowerCase();
    this.verifyMode =
      mode === 'ama_session' || mode === 'local_config'
        ? (mode as AmaVerifyMode)
        : 'local';
    this.logger.log(`AMA token verify mode = ${this.verifyMode}`);
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
  }

  async login(email: string, password: string): Promise<AcmLoginResponse> {
    const user = await this.userRepo.findOne({
      where: { email, status: 'ACTIVE' },
    });
    // REQ-261021B — 계정이 없으면 시스템 테넌트에 마스킹한 ID 로 기록(존재 여부 비공개).
    const actor: AccessActor = user
      ? { entId: user.entId, kind: 'CONSOLE', id: user.id, name: user.name, role: user.role ?? 'ADMIN', loginId: user.email }
      : { entId: AUD_SYSTEM_ENT, kind: 'CONSOLE', loginId: maskLoginId(email) };
    const attempt = { policyEntId: actor.entId, accountKey: consoleAccountKey(email), actor, method: 'PASSWORD' as const };
    const fail = (reason: AccessReason) =>
      this.accessLog.record({ actor, event: 'LOGIN', result: 'FAILURE', reason, method: 'PASSWORD' });
    await this.loginGuard.assertAllowed(attempt);

    if (user && user.lockedAt) {
      await fail('LOCKED');
      throw new HttpException(
        { code: 'ACCOUNT_LOCKED', message: '계정이 잠겼습니다. 관리자에게 문의하세요.' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const ok =
      !!user &&
      !!user.passwordHash &&
      (await bcrypt.compare(password, user.passwordHash));
    if (!ok || !user) {
      await fail(user ? 'BAD_PASSWORD' : 'NO_ACCOUNT');
      const r = await this.loginGuard.onFailure(attempt);
      if (r.permanent)
        throw new HttpException(
          { code: 'ACCOUNT_LOCKED', message: '계정이 잠겼습니다. 관리자에게 문의하세요.' },
          HttpStatus.UNAUTHORIZED,
        );
      if (r.lockedUntil) throw tooMany('ACCOUNT_TEMP_LOCKED', r.lockedUntil);
      throw new UnauthorizedException('Invalid credentials');
    }

    // REQ-261017B — 저장소에 공개된 시드 비밀번호: 운영은 거부, 그 외는 변경 강제.
    if (isPublicSeedHash(user.passwordHash)) {
      if (this.isProduction) {
        this.logger.warn(`public seed password login refused user=${user.id}`);
        await fail('SEED_PASSWORD');
        throw new HttpException(
          {
            code: 'SEED_PASSWORD_DISABLED',
            message: 'The default seed password is disabled. Set ACM_INITIAL_ADMIN_PASSWORD.',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (!user.mustChangePassword) {
        user.mustChangePassword = true;
        await this.userRepo.update(user.id, { mustChangePassword: true });
      }
    }

    // REQ-261017 — 만료된 임시 비밀번호는 거부(다시 요청하도록 안내).
    if (
      user.mustChangePassword &&
      user.tempPasswordExpiresAt &&
      user.tempPasswordExpiresAt.getTime() < Date.now()
    ) {
      await fail('TEMP_PASSWORD_EXPIRED');
      throw new HttpException(
        { code: 'TEMP_PASSWORD_EXPIRED', message: 'Temporary password expired' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.loginGuard.onSuccess(attempt.accountKey);
    await this.accessLog.record({ actor, event: 'LOGIN', result: 'SUCCESS', method: 'PASSWORD' });
    user.lastLoginAt = new Date();
    await this.userRepo.update(user.id, { lastLoginAt: user.lastLoginAt });

    const payload: AcmJwtPayload = {
      sub: user.id,
      entId: user.entId,
      email: user.email,
      name: user.name,
      role: user.role ?? 'ADMIN',
    };
    const accessToken = this.jwtService.sign(payload, sessionSignOptions());
    return {
      accessToken,
      user: {
        id: user.id,
        entId: user.entId,
        email: user.email,
        name: user.name,
        role: user.role ?? 'ADMIN',
        // 요구 260914G — 프론트가 AMA 전용 동작(상담 삭제)을 노출할지 판단한다.
        authSource: user.authSource === 'ama' ? 'ama' : 'local',
        mustChangePassword: user.mustChangePassword ?? false,
      },
    };
  }

  async findById(id: string): Promise<AcmAuthUser | null> {
    const u = await this.userRepo.findOne({ where: { id, status: 'ACTIVE' } });
    // REQ-261021B G5 — 관리자가 잠근 계정은 기존 토큰도 다음 요청부터 거부.
    if (!u || u.lockedAt) return null;
    return {
      id: u.id,
      entId: u.entId,
      email: u.email,
      name: u.name,
      role: u.role ?? 'ADMIN',
      // 요구 260914G — AMA 연동 계정만 상담 삭제를 허용하므로 세션에 싣는다.
      authSource: u.authSource === 'ama' ? 'ama' : 'local',
      mustChangePassword: u.mustChangePassword ?? false,
    };
  }

  /**
   * Provision a new local-login ACM user with the given role.
   * Used by TCH/STF admin flows to create a teacher/staff login account.
   * Throws 409 on duplicate email within tenant; 400 on weak password.
   */
  async createUserWithPassword(input: {
    entId: string;
    email: string;
    plainPassword: string;
    name: string;
    role: AcmRole;
    /** REQ-260621 — force the user to rotate the (temporary) password on first use. */
    mustChangePassword?: boolean;
  }): Promise<{ id: string }> {
    this.assertPasswordPolicy(input.plainPassword);
    const email = input.email.trim().toLowerCase();
    const dup = await this.userRepo.findOne({
      where: { entId: input.entId, email },
    });
    if (dup) {
      throw new HttpException(
        { code: 'USER_EMAIL_DUPLICATE', message: 'Email already exists in tenant' },
        HttpStatus.CONFLICT,
      );
    }
    const passwordHash = await bcrypt.hash(input.plainPassword, 12);
    const saved = await this.userRepo.save(
      this.userRepo.create({
        entId: input.entId,
        email,
        passwordHash,
        name: input.name,
        status: 'ACTIVE',
        role: input.role,
        authSource: 'local',
        mustChangePassword: input.mustChangePassword ?? false,
      }),
    );
    return { id: saved.id };
  }

  /**
   * Reset password for an existing user (admin-driven). The target is forced to
   * rotate the admin-set password on next use (REQ-260621).
   */
  async updateUserPassword(userId: string, plainPassword: string): Promise<void> {
    this.assertPasswordPolicy(plainPassword);
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) {
      throw new HttpException({ code: 'USER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    u.passwordHash = await bcrypt.hash(plainPassword, 12);
    u.mustChangePassword = true;
    u.tempPasswordExpiresAt = null; // 직접 입력한 비밀번호는 만료 없음
    await this.userRepo.save(u);
  }

  /**
   * REQ-261017 — 관리자 임시 비밀번호 발급: 생성·해시 저장·다음 로그인 시 변경 필수·24시간 만료.
   * 평문은 호출자(메일 발송 또는 1회 표시)에게만 돌려주고 저장·로그하지 않는다.
   */
  async issueTempPassword(
    userId: string,
    validHours = 24,
    byUserId: string | null = null,
  ): Promise<{ password: string; expiresAt: Date }> {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) {
      throw new HttpException({ code: 'USER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    const password = generateTempPassword();
    const expiresAt = new Date(Date.now() + validHours * 3600_000);
    u.passwordHash = await bcrypt.hash(password, 12);
    u.mustChangePassword = true;
    u.tempPasswordExpiresAt = expiresAt;
    u.lockedAt = null;
    await this.userRepo.save(u);
    await this.loginGuard.reset(consoleAccountKey(u.email));
    await this.accessLog.record({ actor: this.actorOf(u), event: 'TEMP_PASSWORD_ISSUED', result: 'SUCCESS', reason: 'ADMIN', byUserId });
    return { password, expiresAt };
  }

  /**
   * REQ-260621 — self-service password change. Verifies the current password,
   * sets the new one (policy-checked), and clears the rotation requirement.
   */
  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u || !u.passwordHash) {
      throw new HttpException({ code: 'USER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    const ok = await bcrypt.compare(currentPassword, u.passwordHash);
    if (!ok) {
      await this.accessLog.record({ actor: this.actorOf(u), event: 'PASSWORD_CHANGED', result: 'FAILURE', reason: 'BAD_PASSWORD' });
      throw new UnauthorizedException('CURRENT_PASSWORD_INVALID');
    }
    this.assertPasswordPolicy(newPassword);
    u.passwordHash = await bcrypt.hash(newPassword, 12);
    u.mustChangePassword = false;
    u.tempPasswordExpiresAt = null;
    await this.userRepo.save(u);
    await this.accessLog.record({ actor: this.actorOf(u), event: 'PASSWORD_CHANGED', result: 'SUCCESS', reason: 'SELF' });
  }

  /**
   * Admin-driven account lock. Sets `usr_locked_at = NOW()`. While locked the
   * user cannot login (login() throws ACCOUNT_LOCKED).
   */
  async lockUser(userId: string, byUserId: string | null = null): Promise<void> {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) {
      throw new HttpException({ code: 'USER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    if (u.lockedAt) return;
    u.lockedAt = new Date();
    await this.userRepo.update(userId, { lockedAt: u.lockedAt });
    await this.accessLog.record({ actor: this.actorOf(u), event: 'LOCKED', result: 'SUCCESS', reason: 'ADMIN', byUserId });
  }

  async unlockUser(userId: string, byUserId: string | null = null): Promise<void> {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) {
      throw new HttpException({ code: 'USER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    await this.loginGuard.reset(consoleAccountKey(u.email));
    if (!u.lockedAt) return;
    u.lockedAt = null;
    await this.userRepo.update(userId, { lockedAt: null });
    await this.accessLog.record({ actor: this.actorOf(u), event: 'UNLOCKED', result: 'SUCCESS', reason: 'ADMIN', byUserId });
  }

  /** REQ-261021B — 로그아웃 기록(토큰 폐기는 서버 세션 도입 P3 전까지 클라이언트 몫). */
  async recordLogout(userId: string): Promise<void> {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (u) await this.accessLog.record({ actor: this.actorOf(u), event: 'LOGOUT', result: 'SUCCESS', method: u.authSource === 'ama' ? 'SSO' : 'PASSWORD' });
  }

  private actorOf(u: AcmUserTypeormEntity): AccessActor {
    return { entId: u.entId, kind: 'CONSOLE', id: u.id, name: u.name, role: u.role ?? 'ADMIN', loginId: u.email };
  }

  private assertPasswordPolicy(pw: string): void {
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

  /**
   * Exchange AMA Custom App JWT → ACM JWT.
   * Verifies AMA token, upserts the AMA user into amb_acm_user, and signs an
   * ACM JWT with the same payload shape as login() (FR-AMA-30/31/32/64).
   *
   * Throws HttpException with the AMA error code as the message so the
   * controller returns a deterministic 4xx/5xx with that code.
   */
  async exchangeAmaToken(amaToken: string): Promise<AcmLoginResponse> {
    // REQ-261021B — SSO 로그인도 접속 로그에 남긴다(실패 시 아는 범위까지).
    const ctx: { entId?: string; actor?: AccessActor } = {};
    try {
      const res = await this.exchangeAmaTokenInner(amaToken, ctx);
      await this.accessLog.record({ actor: ctx.actor!, event: 'SSO_EXCHANGE', result: 'SUCCESS', method: 'SSO' });
      return res;
    } catch (e) {
      const code =
        e instanceof HttpException
          ? (e.getResponse() as { code?: string } | string)
          : null;
      const locked = typeof code === 'object' && code?.code === 'ACCOUNT_LOCKED';
      await this.accessLog.record({
        actor: ctx.actor ?? { entId: ctx.entId ?? AUD_SYSTEM_ENT, kind: 'CONSOLE' },
        event: 'SSO_EXCHANGE',
        result: 'FAILURE',
        reason: locked ? 'LOCKED' : 'SSO_INVALID',
        method: 'SSO',
      });
      throw e;
    }
  }

  private async exchangeAmaTokenInner(
    amaToken: string,
    ctx: { entId?: string; actor?: AccessActor },
  ): Promise<AcmLoginResponse> {
    // REQ-260609C — verify the AMA token. `local` = legacy HS256 self-verify;
    // `ama_session` = delegate to the AMA OAuth gateway (token exchange +
    // introspect). Mode-specific error→HTTP mapping happens inside.
    const payload = await this.verifyAmaToken(amaToken);

    // REQ-260609B FR-3 (D-1) — admin-configurable login gate. The token's
    // entityId must match the value an admin registered at /admin/config
    // (amb_acm_ama_config). appCode is excluded from the gate. Runs before the
    // heavier live subscription/membership calls. 403 ENTITY_NOT_ALLOWED.
    //
    // The gate returns the matched config's ACM internal tenant `entId`, which
    // may differ from the AMA `payload.entityId` (FIX-260610: TPI tenant
    // 00000000-…01 ↔ amaEntityId 928f5fe4…). All user scoping + the signed JWT
    // MUST use this resolved acmEntId so AMA-link users land in the same tenant
    // as existing ACM data — never the raw token entityId.
    const acmEntId = await this.amaConfigGate.ensureAllowed(payload.entityId);
    ctx.entId = acmEntId;

    // REQ-260609C (SIMPLE) — in ama_session mode the OAuth exchange+introspect
    // already proved the user is an active member of this entity for our app,
    // so the extra subscription/membership live calls are redundant (and would
    // need AMA platform API creds we don't provision). Build the user straight
    // from the introspect claims (sub + entId).
    const user =
      this.verifyMode === 'ama_session'
        ? await this.upsertSessionUser(payload, acmEntId)
        : this.verifyMode === 'local_config'
          ? await this.upsertLocalConfigUser(payload, acmEntId)
          : await this.loginViaLocalPipeline(payload, acmEntId);

    ctx.actor = this.actorOf(user);
    // REQ-261021B G5 — 관리자가 잠근 계정은 SSO 로도 들어오지 못한다.
    if (user.lockedAt)
      throw new HttpException(
        { code: 'ACCOUNT_LOCKED', message: '계정이 잠겼습니다. 관리자에게 문의하세요.' },
        HttpStatus.UNAUTHORIZED,
      );

    user.lastLoginAt = new Date();
    await this.userRepo.update(user.id, {
      lastLoginAt: user.lastLoginAt,
      // keep email/name in sync with AMA (FR-AMA-24)
      email: user.email,
      name: user.name,
      // persist re-evaluated role + AMA snapshot every login (REQ-260609 FR-B4)
      role: user.role,
      amaRole: user.amaRole,
      amaJobRole: user.amaJobRole,
    });

    this.logger.log(
      `AMA exchange success acmUserId=${user.id} amaUserId=${payload.sub} entId=${user.entId} email=${user.email}`,
    );

    const accessToken = this.signJwt({
      sub: user.id,
      entId: user.entId,
      email: user.email,
      name: user.name,
      role: user.role ?? 'ADMIN',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        entId: user.entId,
        email: user.email,
        name: user.name,
        role: user.role ?? 'ADMIN',
        authSource: 'ama',
      },
    };
  }

  /** REQ-260609C/D — dispatch token verification by configured mode. */
  private async verifyAmaToken(amaToken: string): Promise<AmaTokenPayload> {
    if (this.verifyMode === 'ama_session') return this.verifyViaSession(amaToken);
    if (this.verifyMode === 'local_config')
      return this.verifyViaLocalConfig(amaToken);
    return this.verifyViaLocal(amaToken);
  }

  /**
   * REQ-260609D — verify the Custom App token locally using the secret +
   * expected claims stored in /admin/config (AmaCustomAppVerifier). Token-level
   * failures map to HTTP like local mode; config issues (ENTITY_NOT_ALLOWED 403,
   * AMA_SSO_NOT_CONFIGURED 503) are already HttpExceptions and pass through.
   */
  private async verifyViaLocalConfig(
    amaToken: string,
  ): Promise<AmaTokenPayload> {
    try {
      return await this.customAppVerifier.verify(amaToken);
    } catch (e) {
      if (e instanceof AmaTokenVerifyException) {
        const status =
          e.code === 'AMA_TOKEN_CLAIMS_MISSING'
            ? HttpStatus.BAD_REQUEST
            : e.code === 'AMA_TOKEN_SCOPE_INVALID' ||
                e.code === 'AMA_TOKEN_APP_CODE_INVALID' ||
                e.code === 'AMA_TOKEN_CATEGORY_SLUG_INVALID'
              ? HttpStatus.FORBIDDEN
              : HttpStatus.UNAUTHORIZED;
        this.logger.warn(
          `local_config rejected code=${e.code} reason=${e.message}`,
        );
        throw new HttpException({ code: e.code, message: e.code }, status);
      }
      throw e; // HttpException (ENTITY_NOT_ALLOWED / AMA_SSO_NOT_CONFIGURED)
    }
  }

  /** Legacy local HS256 self-verification (AMA_JWT_SECRET). */
  private verifyViaLocal(amaToken: string): AmaTokenPayload {
    if (!this.amaVerifier.isEnabled()) {
      throw new HttpException(
        { code: 'AMA_SSO_DISABLED', message: 'AMA SSO is not configured' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    try {
      return this.amaVerifier.verify(amaToken);
    } catch (e) {
      if (e instanceof AmaTokenVerifyException) {
        const status =
          e.code === 'AMA_TOKEN_CLAIMS_MISSING'
            ? HttpStatus.BAD_REQUEST
            : e.code === 'AMA_TOKEN_SCOPE_INVALID' ||
                e.code === 'AMA_TOKEN_APP_CODE_INVALID'
              ? HttpStatus.FORBIDDEN
              : HttpStatus.UNAUTHORIZED;
        this.logger.warn(
          `AMA exchange rejected code=${e.code} reason=${e.message}`,
        );
        throw new HttpException({ code: e.code, message: e.code }, status);
      }
      throw e;
    }
  }

  /**
   * REQ-260609C — verify via the AMA OAuth gateway (ama_session grant exchange
   * + introspect). No local signing secret. Maps gateway outcomes to HTTP:
   *   invalid_ama_token/unknown → 401, invalid_scope/user_inactive → 403,
   *   invalid_client → 500 (our misconfig), 5xx/network/timeout → 503.
   */
  private async verifyViaSession(amaToken: string): Promise<AmaTokenPayload> {
    try {
      return await this.sessionExchanger.verify(amaToken);
    } catch (e) {
      if (e instanceof AmaOAuthUnavailableException) {
        this.logger.error(`ama_session unavailable: ${e.reason}`);
        throw new HttpException(
          { code: 'AMA_UNAVAILABLE', message: 'AMA gateway unavailable' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (e instanceof AmaOAuthRejectedException) {
        const status =
          e.code === 'invalid_scope' || e.code === 'user_inactive'
            ? HttpStatus.FORBIDDEN
            : e.code === 'invalid_client'
              ? HttpStatus.INTERNAL_SERVER_ERROR
              : HttpStatus.UNAUTHORIZED;
        const code =
          e.code === 'user_inactive'
            ? 'USER_INACTIVE'
            : e.code === 'invalid_scope'
              ? 'AMA_SCOPE_INVALID'
              : e.code === 'invalid_client'
                ? 'AMA_CLIENT_MISCONFIGURED'
                : 'AMA_TOKEN_INVALID';
        this.logger.warn(`ama_session rejected code=${e.code} reason=${e.message}`);
        throw new HttpException({ code, message: code }, status);
      }
      throw e;
    }
  }

  /**
   * REQ-260604 — legacy local-mode pipeline: live subscription + membership
   * checks, role mapping from USER_LEVEL + job field, then upsert. The
   * membership record supplies email/name/level for the user row.
   */
  private async loginViaLocalPipeline(
    payload: AmaTokenPayload,
    acmEntId: string,
  ): Promise<AcmUserTypeormEntity> {
    const subCheck = await this.subscriptionCheck.ensureActive(
      payload.entityId,
    );
    if (subCheck.degraded) {
      this.logger.warn(
        `degraded login (live 5xx + cache hit) entId=${payload.entityId} sub=${payload.sub}`,
      );
    }

    const member = await this.membershipGuard.ensureMember(
      payload.entityId,
      payload.sub,
    );

    const jobRole = payload.jobRole ?? member.jobRole ?? null;
    const acmRole: AcmRole =
      mapAcmRole(payload.role, jobRole) === 'ADMIN' ||
      mapAcmRole(member.level, jobRole) === 'ADMIN'
        ? 'ADMIN'
        : mapAcmRole(payload.role, jobRole);

    const email = payload.email || member.email;
    const displayName = member.name || email.split('@')[0] || email;
    const amaLevel =
      payload.role && payload.role !== 'UNKNOWN' ? payload.role : member.level;
    const enriched: AmaTokenPayload = { ...payload, email, role: amaLevel };

    return this.upsertAmaUser(enriched, acmRole, jobRole, displayName, acmEntId);
  }

  /**
   * REQ-260609C (SIMPLE) — ama_session upsert from introspect claims only.
   * No subscription/membership calls. Keyed by (entId, amaUserId=sub).
   * New SSO users default to ADMIN (per decision 2026-06-09); existing users
   * keep their current role. introspect carries no email/name, so a stable
   * per-user placeholder email is derived to avoid collisions.
   */
  private async upsertSessionUser(
    payload: AmaTokenPayload,
    acmEntId: string,
  ): Promise<AcmUserTypeormEntity> {
    const email = payload.email || `${payload.sub}@ama-sso.local`;
    const displayName = payload.email
      ? payload.email.split('@')[0] || payload.email
      : payload.sub;
    const amaRole =
      payload.role && payload.role !== 'UNKNOWN' ? payload.role : null;

    let user = await this.userRepo.findOne({
      where: { entId: acmEntId, amaUserId: payload.sub },
    });

    if (!user) {
      const created = this.userRepo.create({
        entId: acmEntId,
        email,
        name: displayName,
        passwordHash: null,
        status: 'ACTIVE',
        authSource: 'ama',
        role: 'ADMIN', // default for new SSO users (REQ-260609C decision)
        amaUserId: payload.sub,
        amaEntityId: payload.entityId,
        amaRole,
        amaJobRole: null,
      });
      const saved = await this.userRepo.save(created);
      this.logger.log(`ama_session user created id=${saved.id} sub=${payload.sub}`);
      return saved;
    }

    // Existing user — link AMA fields, KEEP current role.
    const dirty: Partial<AcmUserTypeormEntity> = {};
    if (!user.amaUserId) dirty.amaUserId = payload.sub;
    if (user.amaEntityId !== payload.entityId)
      dirty.amaEntityId = payload.entityId;
    if (user.authSource !== 'ama') dirty.authSource = 'ama';
    if (amaRole && user.amaRole !== amaRole) dirty.amaRole = amaRole;
    if (Object.keys(dirty).length > 0) {
      Object.assign(user, dirty);
      user = await this.userRepo.save(user);
    }
    return user;
  }

  /**
   * REQ-260609D (local_config) — upsert from the verified Custom App token.
   * The token carries sub/email/role, so role maps from USER_LEVEL + jobRole
   * (MASTER→ADMIN) and email/name come from the token — no membership call.
   */
  private async upsertLocalConfigUser(
    payload: AmaTokenPayload,
    acmEntId: string,
  ): Promise<AcmUserTypeormEntity> {
    const jobRole = payload.jobRole ?? null;
    const acmRole = mapAcmRole(payload.role, jobRole);
    const displayName = payload.email
      ? payload.email.split('@')[0] || payload.email
      : payload.sub;
    return this.upsertAmaUser(payload, acmRole, jobRole, displayName, acmEntId);
  }

  private async upsertAmaUser(
    payload: AmaTokenPayload,
    acmRole: AcmRole,
    jobRole: string | null,
    displayName: string,
    acmEntId: string,
  ): Promise<AcmUserTypeormEntity> {
    // 1. Lookup by AMA user id (primary key for AMA-source users).
    let user = await this.userRepo.findOne({
      where: { entId: acmEntId, amaUserId: payload.sub },
    });

    // 2. Fallback — same tenant + email match → adopt as AMA-linked. This is
    //    what lets an AMA Custom App login resolve to the pre-existing ACM
    //    account (e.g. admin@tpi.co.kr) instead of spawning a duplicate.
    if (!user) {
      user = await this.userRepo.findOne({
        where: { entId: acmEntId, email: payload.email },
      });
      if (user) {
        user.amaUserId = payload.sub;
        user.amaEntityId = payload.entityId;
        user.amaRole = payload.role;
        user.amaJobRole = jobRole;
        user.role = acmRole;
        user.authSource = 'ama';
        user = await this.userRepo.save(user);
      }
    }

    // 3. Create new AMA-provisioned user.
    if (!user) {
      const created = this.userRepo.create({
        entId: acmEntId,
        email: payload.email,
        name: displayName,
        passwordHash: null,
        status: 'ACTIVE',
        authSource: 'ama',
        role: acmRole,
        amaUserId: payload.sub,
        amaEntityId: payload.entityId,
        amaRole: payload.role,
        amaJobRole: jobRole,
      });
      user = await this.userRepo.save(created);
    } else {
      // Sync mutable fields — role/jobRole re-evaluated each login (FR-B4).
      const dirty: Partial<AcmUserTypeormEntity> = {};
      if (user.email !== payload.email) dirty.email = payload.email;
      if (displayName && user.name !== displayName) dirty.name = displayName;
      if (user.amaRole !== payload.role) dirty.amaRole = payload.role;
      if (user.amaJobRole !== jobRole) dirty.amaJobRole = jobRole;
      if (user.role !== acmRole) dirty.role = acmRole;
      if (user.amaEntityId !== payload.entityId)
        dirty.amaEntityId = payload.entityId;
      if (Object.keys(dirty).length > 0) {
        Object.assign(user, dirty);
      }
    }

    return user;
  }

  private signJwt(payload: AcmJwtPayload): string {
    return this.jwtService.sign(payload, sessionSignOptions());
  }

}
