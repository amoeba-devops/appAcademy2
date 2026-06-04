import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
import { AcmAuthUser, AcmLoginResponse } from './dto/acm-auth.dto';
import { SubscriptionCheckService } from './subscription-check.service';
import { UserMembershipGuard } from './user-membership.guard';

export interface AcmJwtPayload {
  sub: string;
  entId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'TEACHER' | 'STAFF';
}

interface FailureWindow {
  count: number;
  firstAt: number;
  lockedUntil: number;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;
const LOCKOUT_MS = 60_000;

@Injectable()
export class AcmAuthService {
  private readonly logger = new Logger(AcmAuthService.name);
  private readonly failures = new Map<string, FailureWindow>();

  constructor(
    @InjectRepository(AcmUserTypeormEntity, ACM_DS)
    private readonly userRepo: Repository<AcmUserTypeormEntity>,
    private readonly jwtService: JwtService,
    private readonly amaVerifier: AmaTokenVerifier,
    private readonly subscriptionCheck: SubscriptionCheckService,
    private readonly membershipGuard: UserMembershipGuard,
  ) {}

  async login(email: string, password: string): Promise<AcmLoginResponse> {
    this.assertNotLocked(email);

    const user = await this.userRepo.findOne({
      where: { email, status: 'ACTIVE' },
    });

    if (user && user.lockedAt) {
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
      this.recordFailure(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.failures.delete(email);
    user.lastLoginAt = new Date();
    await this.userRepo.update(user.id, { lastLoginAt: user.lastLoginAt });

    const payload: AcmJwtPayload = {
      sub: user.id,
      entId: user.entId,
      email: user.email,
      name: user.name,
      role: user.role ?? 'ADMIN',
    };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        entId: user.entId,
        email: user.email,
        name: user.name,
        role: user.role ?? 'ADMIN',
      },
    };
  }

  async findById(id: string): Promise<AcmAuthUser | null> {
    const u = await this.userRepo.findOne({ where: { id, status: 'ACTIVE' } });
    if (!u) return null;
    return { id: u.id, entId: u.entId, email: u.email, name: u.name, role: u.role ?? 'ADMIN' };
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
    role: 'ADMIN' | 'TEACHER' | 'STAFF';
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
      }),
    );
    return { id: saved.id };
  }

  /**
   * Reset password for an existing user (admin-driven).
   */
  async updateUserPassword(userId: string, plainPassword: string): Promise<void> {
    this.assertPasswordPolicy(plainPassword);
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) {
      throw new HttpException({ code: 'USER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    u.passwordHash = await bcrypt.hash(plainPassword, 12);
    await this.userRepo.save(u);
  }

  /**
   * Admin-driven account lock. Sets `usr_locked_at = NOW()`. While locked the
   * user cannot login (login() throws ACCOUNT_LOCKED).
   */
  async lockUser(userId: string): Promise<void> {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) {
      throw new HttpException({ code: 'USER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    if (u.lockedAt) return;
    u.lockedAt = new Date();
    await this.userRepo.update(userId, { lockedAt: u.lockedAt });
  }

  async unlockUser(userId: string): Promise<void> {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) {
      throw new HttpException({ code: 'USER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    if (!u.lockedAt) return;
    u.lockedAt = null;
    await this.userRepo.update(userId, { lockedAt: null });
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
    if (!this.amaVerifier.isEnabled()) {
      throw new HttpException(
        { code: 'AMA_SSO_DISABLED', message: 'AMA SSO is not configured' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    let payload: AmaTokenPayload;
    try {
      payload = this.amaVerifier.verify(amaToken);
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

    // REQ-260604 v2 FR-1 + FR-9 — live stg-apps subscription check with
    // 24h cache fallback. Throws HttpException on terminal failure
    // (NO_ACADEMY / NO_SUBSCRIPTION / SUBSCRIPTION_<status> / AMA_UNAVAILABLE).
    // Break-glass email/password login bypasses this — it goes through
    // loginWithPassword, not exchangeAmaToken (AC-4-1).
    const subCheck = await this.subscriptionCheck.ensureActive(
      payload.entityId,
    );
    if (subCheck.degraded) {
      this.logger.warn(
        `degraded login (live 5xx + cache hit) entId=${payload.entityId} sub=${payload.sub}`,
      );
    }

    // REQ-260604 v2 FR-2 — live ama platform membership check. No cache
    // fallback: membership has no defensible grace window (an HR-revoked
    // user must lose access immediately). 404 → USER_NOT_IN_ENTITY (403),
    // 5xx → AMA_UNAVAILABLE (503, fail-closed).
    await this.membershipGuard.ensureMember(payload.entityId, payload.sub);

    const user = await this.upsertAmaUser(payload);

    user.lastLoginAt = new Date();
    await this.userRepo.update(user.id, {
      lastLoginAt: user.lastLoginAt,
      // keep email/name in sync with AMA (FR-AMA-24)
      email: user.email,
      name: user.name,
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

  private async upsertAmaUser(
    payload: AmaTokenPayload,
  ): Promise<AcmUserTypeormEntity> {
    // 1. Lookup by AMA user id (primary key for AMA-source users).
    let user = await this.userRepo.findOne({
      where: { entId: payload.entityId, amaUserId: payload.sub },
    });

    // 2. Fallback — same tenant + email match → adopt as AMA-linked.
    if (!user) {
      user = await this.userRepo.findOne({
        where: { entId: payload.entityId, email: payload.email },
      });
      if (user) {
        user.amaUserId = payload.sub;
        user.amaEntityId = payload.entityId;
        user.amaRole = payload.role;
        user.authSource = 'ama';
        user = await this.userRepo.save(user);
      }
    }

    // 3. Create new AMA-provisioned user.
    if (!user) {
      const created = this.userRepo.create({
        entId: payload.entityId,
        email: payload.email,
        name: payload.email.split('@')[0] || payload.email,
        passwordHash: null,
        status: 'ACTIVE',
        authSource: 'ama',
        amaUserId: payload.sub,
        amaEntityId: payload.entityId,
        amaRole: payload.role,
      });
      user = await this.userRepo.save(created);
    } else {
      // Sync mutable fields.
      const dirty: Partial<AcmUserTypeormEntity> = {};
      if (user.email !== payload.email) dirty.email = payload.email;
      if (user.amaRole !== payload.role) dirty.amaRole = payload.role;
      if (user.amaEntityId !== payload.entityId)
        dirty.amaEntityId = payload.entityId;
      if (Object.keys(dirty).length > 0) {
        Object.assign(user, dirty);
      }
    }

    return user;
  }

  private signJwt(payload: AcmJwtPayload): string {
    return this.jwtService.sign(payload);
  }

  private assertNotLocked(email: string): void {
    const w = this.failures.get(email);
    if (w && w.lockedUntil > Date.now()) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many attempts. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailure(email: string): void {
    const now = Date.now();
    const w = this.failures.get(email);
    if (!w || now - w.firstAt > WINDOW_MS) {
      this.failures.set(email, { count: 1, firstAt: now, lockedUntil: 0 });
      return;
    }
    w.count += 1;
    if (w.count >= MAX_ATTEMPTS) {
      w.lockedUntil = now + LOCKOUT_MS;
    }
    this.failures.set(email, w);
  }
}
