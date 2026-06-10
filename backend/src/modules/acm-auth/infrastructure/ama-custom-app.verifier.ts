import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { AmaConfigTypeormEntity } from './typeorm/ama-config.typeorm-entity';
import { unpackEncrypted } from './ama-secret.codec';
import {
  AmaTokenVerifyException,
  type AmaTokenPayload,
} from './ama-token.verifier';

const CLOCK_SKEW_SEC = 30;

/**
 * REQ-260609D — local_config 모드 Custom App 토큰 검증.
 *
 * 사이드바가 발급하는 Custom App 토큰(custom_app:context, HS256)을, 어드민이
 * /admin/config 에 입력한 secret/expectedScope 로 ACM 이 직접 검증한다.
 *
 *   ① 토큰 decode(무검증) → entityId 추출
 *   ② active config 조회 (amaEntityId = entityId)
 *   ③ config secret 복호화 → jwt.verify(HS256, clockTolerance)
 *   ④ scope / appCode / entityId 클레임 일치 검증
 *
 * 토큰은 sub·email·role 을 모두 담고 있어 멤버십/디렉터리 조회 없이 사용자
 * 생성이 가능하다 (호출부 upsert).
 */
@Injectable()
export class AmaCustomAppVerifier {
  private readonly logger = new Logger(AmaCustomAppVerifier.name);

  constructor(
    @InjectRepository(AmaConfigTypeormEntity, ACM_DS)
    private readonly repo: Repository<AmaConfigTypeormEntity>,
    private readonly aes: AesGcmService,
  ) {}

  async verify(amaToken: string): Promise<AmaTokenPayload> {
    // ① decode without verifying — only to route to the right tenant config.
    const decoded = jwt.decode(amaToken);
    const entityId =
      decoded && typeof decoded === 'object'
        ? (decoded as Record<string, unknown>).entityId
        : undefined;
    if (typeof entityId !== 'string' || !entityId) {
      throw new AmaTokenVerifyException('AMA_TOKEN_CLAIMS_MISSING');
    }

    // ② active config for this entity.
    const cfg = await this.repo.findOne({
      where: { amaEntityId: entityId, isActive: true },
    });
    if (!cfg) {
      this.deny(entityId, 'no active AMA config for entityId');
    }
    if (!cfg!.customAppSecretEnc?.length) {
      throw new HttpException(
        {
          code: 'AMA_SSO_NOT_CONFIGURED',
          message: 'Custom App secret is not set in /admin/config',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // ③ verify signature with the decrypted secret.
    const secret = this.aes.decrypt(unpackEncrypted(cfg!.customAppSecretEnc));
    let p: jwt.JwtPayload;
    try {
      const v = jwt.verify(amaToken, secret, {
        algorithms: ['HS256'],
        clockTolerance: CLOCK_SKEW_SEC,
      });
      if (typeof v !== 'object' || v === null) {
        throw new AmaTokenVerifyException('AMA_TOKEN_CLAIMS_MISSING');
      }
      p = v;
    } catch (e) {
      if (e instanceof AmaTokenVerifyException) throw e;
      const err = e as jwt.VerifyErrors;
      if (err?.name === 'TokenExpiredError') {
        throw new AmaTokenVerifyException('AMA_TOKEN_EXPIRED');
      }
      throw new AmaTokenVerifyException(
        'AMA_TOKEN_INVALID_SIGNATURE',
        err?.message,
      );
    }

    const claims = p as jwt.JwtPayload & Partial<AmaTokenPayload>;
    if (!claims.sub || !claims.email || !claims.entityId) {
      throw new AmaTokenVerifyException('AMA_TOKEN_CLAIMS_MISSING');
    }

    // ④ claim checks against admin config.
    if (cfg!.expectedScope && claims.scope !== cfg!.expectedScope) {
      throw new AmaTokenVerifyException(
        'AMA_TOKEN_SCOPE_INVALID',
        `scope=${claims.scope} != ${cfg!.expectedScope}`,
      );
    }
    if (cfg!.appCode && claims.appCode && claims.appCode !== cfg!.appCode) {
      throw new AmaTokenVerifyException(
        'AMA_TOKEN_APP_CODE_INVALID',
        `appCode=${claims.appCode} != ${cfg!.appCode}`,
      );
    }
    if (claims.entityId !== entityId) {
      // signed payload entityId must match the routing claim.
      this.deny(entityId, `signed entityId=${claims.entityId} mismatch`);
    }

    const cc = p as jwt.JwtPayload & Record<string, unknown>;
    return {
      sub: claims.sub,
      email: claims.email,
      role: typeof claims.role === 'string' ? claims.role : 'UNKNOWN',
      entityId: claims.entityId,
      entityCode:
        typeof cc.entityCode === 'string' ? (cc.entityCode as string) : null,
      jobRole:
        typeof cc.jobRole === 'string'
          ? (cc.jobRole as string)
          : typeof cc.position === 'string'
            ? (cc.position as string)
            : null,
      appId: typeof claims.appId === 'string' ? claims.appId : '',
      appCode: typeof claims.appCode === 'string' ? claims.appCode : '',
      scope: typeof claims.scope === 'string' ? claims.scope : '',
      iat: typeof claims.iat === 'number' ? claims.iat : 0,
      exp: typeof claims.exp === 'number' ? claims.exp : 0,
    };
  }

  private deny(entityId: string, reason: string): never {
    this.logger.warn(`local_config gate denied entityId=${entityId} — ${reason}`);
    throw new HttpException(
      {
        code: 'ENTITY_NOT_ALLOWED',
        message: 'This AMA entity is not allowed to sign in',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
