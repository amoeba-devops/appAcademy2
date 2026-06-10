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

const SCOPE_APP = 'custom_app:context';
const SCOPE_CATEGORY = 'custom_category:context';

/**
 * REQ-260609D — local_config 모드 Custom App / Custom Category 토큰 검증.
 *
 * AMA 사이드바 진입 토큰을 어드민이 /admin/config 에 입력한 secret 으로 ACM 이
 * 직접 검증한다. 커스텀앱(/apps)과 커스텀카테고리(/menu)는 **별개 통합**이라
 * scope·식별자·서명 secret 이 다르므로, 토큰 scope 로 분기한다:
 *
 *   custom_app:context      → customAppSecretEnc 로 서명검증, appCode == cfg.appCode
 *   custom_category:context → categorySecretEnc  로 서명검증, eccSlug == cfg.categorySlug
 *
 *   ① 토큰 decode(무검증) → entityId + scope 추출
 *   ② active config 조회 (amaEntityId = entityId)
 *   ③ scope 로 secret/식별자 선택 → secret 복호화 → jwt.verify(HS256)
 *   ④ 식별자(appCode/eccSlug) / entityId 클레임 일치 검증
 *
 * 두 토큰 모두 sub·email·role·entityId 를 담고 있어 동일 사용자·동일 테넌트로
 * 로그인된다 (호출부 upsert + 게이트는 entityId 만 사용). 멤버십/디렉터리 조회 불요.
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
    // ① decode without verifying — only to route to the right tenant config + secret.
    const decoded = jwt.decode(amaToken);
    const dc =
      decoded && typeof decoded === 'object'
        ? (decoded as Record<string, unknown>)
        : {};
    const entityId = dc.entityId;
    const scope = typeof dc.scope === 'string' ? dc.scope : '';
    if (typeof entityId !== 'string' || !entityId) {
      throw new AmaTokenVerifyException('AMA_TOKEN_CLAIMS_MISSING');
    }
    // Route by scope — only the two known Custom integration scopes are accepted.
    if (scope !== SCOPE_APP && scope !== SCOPE_CATEGORY) {
      throw new AmaTokenVerifyException(
        'AMA_TOKEN_SCOPE_INVALID',
        `unsupported scope=${scope}`,
      );
    }

    // ② active config for this entity.
    const cfg = await this.repo.findOne({
      where: { amaEntityId: entityId, isActive: true },
    });
    if (!cfg) {
      this.deny(entityId, 'no active AMA config for entityId');
    }

    // ③ pick the secret for this scope (app vs category — different secrets).
    const secretEnc =
      scope === SCOPE_CATEGORY
        ? cfg!.categorySecretEnc
        : cfg!.customAppSecretEnc;
    if (!secretEnc?.length) {
      throw new HttpException(
        {
          code: 'AMA_SSO_NOT_CONFIGURED',
          message:
            scope === SCOPE_CATEGORY
              ? 'Custom Category secret is not set in /admin/config'
              : 'Custom App secret is not set in /admin/config',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // verify signature with the decrypted secret for this scope.
    const secret = this.aes.decrypt(unpackEncrypted(secretEnc));
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

    // ④ identifier check against admin config — appCode (app) or eccSlug (category).
    const cc = p as jwt.JwtPayload & Record<string, unknown>;
    if (scope === SCOPE_CATEGORY) {
      const eccSlug = typeof cc.eccSlug === 'string' ? cc.eccSlug : '';
      if (cfg!.categorySlug && eccSlug && eccSlug !== cfg!.categorySlug) {
        throw new AmaTokenVerifyException(
          'AMA_TOKEN_CATEGORY_SLUG_INVALID',
          `eccSlug=${eccSlug} != ${cfg!.categorySlug}`,
        );
      }
    } else if (cfg!.appCode && claims.appCode && claims.appCode !== cfg!.appCode) {
      throw new AmaTokenVerifyException(
        'AMA_TOKEN_APP_CODE_INVALID',
        `appCode=${claims.appCode} != ${cfg!.appCode}`,
      );
    }
    if (claims.entityId !== entityId) {
      // signed payload entityId must match the routing claim.
      this.deny(entityId, `signed entityId=${claims.entityId} mismatch`);
    }

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
