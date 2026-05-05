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

export interface AcmJwtPayload {
  sub: string;
  entId: string;
  email: string;
  name: string;
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
  ) {}

  async login(email: string, password: string): Promise<AcmLoginResponse> {
    this.assertNotLocked(email);

    const user = await this.userRepo.findOne({
      where: { email, status: 'ACTIVE' },
    });
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
    };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        entId: user.entId,
        email: user.email,
        name: user.name,
      },
    };
  }

  async findById(id: string): Promise<AcmAuthUser | null> {
    const u = await this.userRepo.findOne({ where: { id, status: 'ACTIVE' } });
    if (!u) return null;
    return { id: u.id, entId: u.entId, email: u.email, name: u.name };
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
    });

    return {
      accessToken,
      user: {
        id: user.id,
        entId: user.entId,
        email: user.email,
        name: user.name,
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
