import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { AmaConfigTypeormEntity } from './typeorm/ama-config.typeorm-entity';
import { AmaCustomAppVerifier } from './ama-custom-app.verifier';
import { AmaTokenVerifyException } from './ama-token.verifier';

const APP_SECRET = 'custom-app-hs256-secret-32bytes-min!!';
const CAT_SECRET = 'custom-category-hs256-secret-32bytes!';
const ENTITY = '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b';

// Marker blobs — decrypt() maps the ciphertext tail back to the right secret,
// so the app vs category secrets are genuinely DIFFERENT (mirrors production).
const APP_ENC = Buffer.concat([Buffer.alloc(28), Buffer.from('APP')]);
const CAT_ENC = Buffer.concat([Buffer.alloc(28), Buffer.from('CAT')]);

function appToken(over: Record<string, unknown> = {}, signWith = APP_SECRET): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: 'c31e3cc1-c8c2-4a9a-8dbb-c0c39d6b6570',
      email: 'fremd@naver.com',
      role: 'MASTER',
      entityId: ENTITY,
      scope: 'custom_app:context',
      appCode: 'tpi-academy',
      iat: now,
      exp: now + 3600,
      ...over,
    },
    signWith,
    { algorithm: 'HS256' },
  );
}

function categoryToken(over: Record<string, unknown> = {}, signWith = CAT_SECRET): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: 'c31e3cc1-c8c2-4a9a-8dbb-c0c39d6b6570',
      email: 'fremd@naver.com',
      role: 'MASTER',
      entityId: ENTITY,
      scope: 'custom_category:context',
      eccSlug: 'tpi-academy',
      eccId: 'e69b0f96-4414-48ce-93f1-0effc0738682',
      iat: now,
      exp: now + 3600,
      ...over,
    },
    signWith,
    { algorithm: 'HS256' },
  );
}

describe('AmaCustomAppVerifier (REQ-260609D + Custom Category)', () => {
  let svc: AmaCustomAppVerifier;
  let findOne: jest.Mock;

  const cfg = (over: Partial<AmaConfigTypeormEntity> = {}): AmaConfigTypeormEntity =>
    ({
      id: 'amc-1',
      entId: ENTITY,
      amaEntityId: ENTITY,
      appCode: 'tpi-academy',
      isActive: true,
      customAppSecretEnc: APP_ENC,
      categorySecretEnc: CAT_ENC,
      categorySlug: 'tpi-academy',
      expectedScope: null,
      ...over,
    }) as AmaConfigTypeormEntity;

  const build = async () => {
    findOne = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        AmaCustomAppVerifier,
        { provide: getRepositoryToken(AmaConfigTypeormEntity, ACM_DS), useValue: { findOne } },
        // decrypt() yields the secret matching the blob the verifier picked.
        {
          provide: AesGcmService,
          useValue: {
            decrypt: (f: { ciphertext: Buffer }) => {
              const tail = f.ciphertext.toString();
              if (tail === 'APP') return APP_SECRET;
              if (tail === 'CAT') return CAT_SECRET;
              return 'unknown-secret';
            },
          },
        },
      ],
    }).compile();
    svc = mod.get(AmaCustomAppVerifier);
  };

  it('verifies a Custom App token with the app secret', async () => {
    await build();
    findOne.mockResolvedValue(cfg());
    const p = await svc.verify(appToken());
    expect(p.sub).toBe('c31e3cc1-c8c2-4a9a-8dbb-c0c39d6b6570');
    expect(p.email).toBe('fremd@naver.com');
    expect(p.scope).toBe('custom_app:context');
  });

  it('verifies a Custom Category token with the category secret', async () => {
    await build();
    findOne.mockResolvedValue(cfg());
    const p = await svc.verify(categoryToken());
    expect(p.sub).toBe('c31e3cc1-c8c2-4a9a-8dbb-c0c39d6b6570');
    expect(p.email).toBe('fremd@naver.com');
    expect(p.entityId).toBe(ENTITY);
    expect(p.scope).toBe('custom_category:context');
  });

  it('rejects a Custom Category token signed with the APP secret (the prod bug)', async () => {
    await build();
    findOne.mockResolvedValue(cfg());
    await expect(svc.verify(categoryToken({}, APP_SECRET))).rejects.toMatchObject({
      code: 'AMA_TOKEN_INVALID_SIGNATURE',
    } as Partial<AmaTokenVerifyException>);
  });

  it('rejects an app token signed with the wrong secret', async () => {
    await build();
    findOne.mockResolvedValue(cfg());
    await expect(svc.verify(appToken({}, 'wrong-secret'))).rejects.toMatchObject({
      code: 'AMA_TOKEN_INVALID_SIGNATURE',
    } as Partial<AmaTokenVerifyException>);
  });

  it('denies when no active config for the entityId', async () => {
    await build();
    findOne.mockResolvedValue(null);
    await expect(svc.verify(appToken())).rejects.toMatchObject({
      response: { code: 'ENTITY_NOT_ALLOWED' },
    } as Partial<HttpException>);
  });

  it('returns 503 when the app secret is not set (app token)', async () => {
    await build();
    findOne.mockResolvedValue(cfg({ customAppSecretEnc: null }));
    await expect(svc.verify(appToken())).rejects.toMatchObject({
      response: { code: 'AMA_SSO_NOT_CONFIGURED' },
    } as Partial<HttpException>);
  });

  it('returns 503 for a category token when only the app secret is set (no fallback)', async () => {
    await build();
    findOne.mockResolvedValue(cfg({ categorySecretEnc: null }));
    await expect(svc.verify(categoryToken())).rejects.toMatchObject({
      response: { code: 'AMA_SSO_NOT_CONFIGURED' },
    } as Partial<HttpException>);
  });

  it('rejects an unsupported scope', async () => {
    await build();
    findOne.mockResolvedValue(cfg());
    await expect(
      svc.verify(appToken({ scope: 'app_store:context' })),
    ).rejects.toMatchObject({
      code: 'AMA_TOKEN_SCOPE_INVALID',
    } as Partial<AmaTokenVerifyException>);
  });

  it('rejects a category token whose eccSlug mismatches the configured slug', async () => {
    await build();
    findOne.mockResolvedValue(cfg());
    await expect(
      svc.verify(categoryToken({ eccSlug: 'other-category' })),
    ).rejects.toMatchObject({
      code: 'AMA_TOKEN_CATEGORY_SLUG_INVALID',
    } as Partial<AmaTokenVerifyException>);
  });

  it('rejects an app token whose appCode mismatches the configured appCode', async () => {
    await build();
    findOne.mockResolvedValue(cfg());
    await expect(
      svc.verify(appToken({ appCode: 'other-app' })),
    ).rejects.toMatchObject({
      code: 'AMA_TOKEN_APP_CODE_INVALID',
    } as Partial<AmaTokenVerifyException>);
  });
});
