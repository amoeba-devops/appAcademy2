import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

/**
 * Decoded AMA Custom App context JWT payload.
 * @see docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md §1.1
 */
export interface AmaTokenPayload {
  sub: string; // AMA user UUID
  email: string;
  role: string; // USER_LEVEL, e.g. 'MASTER' | 'MANAGER' | 'MEMBER' | 'VIEWER'
  entityId: string; // AMA tenant UUID
  entityCode: string | null; // human-readable entity code, e.g. 'VN3040' (optional claim)
  jobRole: string | null; // AMA job/position field, e.g. 'TEACHER' (optional claim; else fetched live)
  appId: string;
  appCode: string; // e.g. 'tpi-acm'
  scope: string; // e.g. 'custom_app:context'
  iat: number;
  exp: number;
}

export type AmaVerifyError =
  | 'AMA_TOKEN_INVALID_SIGNATURE'
  | 'AMA_TOKEN_EXPIRED'
  | 'AMA_TOKEN_SCOPE_INVALID'
  | 'AMA_TOKEN_APP_CODE_INVALID'
  | 'AMA_TOKEN_CATEGORY_SLUG_INVALID'
  | 'AMA_TOKEN_CLAIMS_MISSING';

export class AmaTokenVerifyException extends Error {
  constructor(public readonly code: AmaVerifyError, message?: string) {
    super(message ?? code);
    this.name = 'AmaTokenVerifyException';
  }
}

const REQUIRED_SCOPE = 'custom_app:context';
const CLOCK_SKEW_SEC = 30;

@Injectable()
export class AmaTokenVerifier {
  private readonly logger = new Logger(AmaTokenVerifier.name);
  private readonly secret: string;
  private readonly enabled: boolean;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const secret = config.get<string>('AMA_JWT_SECRET') ?? '';
    this.secret = secret;
    this.enabled = secret.length >= 16;
    if (!this.enabled) {
      this.logger.warn(
        'AMA_JWT_SECRET is missing or too short — AMA SSO disabled. ' +
          '/api/acm/auth/ama-exchange will return 503.',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  verify(token: string): AmaTokenPayload {
    if (!this.enabled) {
      throw new AmaTokenVerifyException(
        'AMA_TOKEN_INVALID_SIGNATURE',
        'AMA SSO is not configured (AMA_JWT_SECRET missing)',
      );
    }
    let decoded: jwt.JwtPayload | string;
    try {
      decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        clockTolerance: CLOCK_SKEW_SEC,
      });
    } catch (e) {
      const err = e as jwt.VerifyErrors;
      if (err.name === 'TokenExpiredError') {
        throw new AmaTokenVerifyException('AMA_TOKEN_EXPIRED');
      }
      throw new AmaTokenVerifyException(
        'AMA_TOKEN_INVALID_SIGNATURE',
        err.message,
      );
    }

    if (typeof decoded !== 'object' || decoded === null) {
      throw new AmaTokenVerifyException('AMA_TOKEN_CLAIMS_MISSING');
    }

    const p = decoded as jwt.JwtPayload & Partial<AmaTokenPayload>;
    if (
      !p.sub ||
      !p.email ||
      !p.entityId ||
      !p.appCode ||
      !p.scope ||
      typeof p.iat !== 'number' ||
      typeof p.exp !== 'number'
    ) {
      throw new AmaTokenVerifyException('AMA_TOKEN_CLAIMS_MISSING');
    }

    if (p.scope !== REQUIRED_SCOPE) {
      throw new AmaTokenVerifyException('AMA_TOKEN_SCOPE_INVALID');
    }

    // appCode authorization moved to AmaConfigGateService (REQ-260609B FR-3.3):
    // the admin-configured (entityId, appCode) in amb_acm_ama_config is now the
    // single source of truth. The verifier only enforces signature / claim
    // presence / scope structure here; appCode presence is asserted above.

    // Optional claims (REQ-260609). `entityCode` lets the entity gate
    // cross-check the human-readable code; `jobRole` lets role mapping skip
    // the live directory lookup when AMA already embeds the job field.
    const pp = p as jwt.JwtPayload & Record<string, unknown>;
    const entityCode =
      typeof pp.entityCode === 'string'
        ? pp.entityCode
        : typeof pp.entitySlug === 'string'
          ? pp.entitySlug
          : null;
    const jobRole =
      typeof pp.jobRole === 'string'
        ? pp.jobRole
        : typeof pp.position === 'string'
          ? pp.position
          : null;

    return {
      sub: p.sub,
      email: p.email,
      role: p.role ?? 'UNKNOWN',
      entityId: p.entityId,
      entityCode,
      jobRole,
      appId: p.appId ?? '',
      appCode: p.appCode,
      scope: p.scope,
      iat: p.iat,
      exp: p.exp,
    };
  }
}
