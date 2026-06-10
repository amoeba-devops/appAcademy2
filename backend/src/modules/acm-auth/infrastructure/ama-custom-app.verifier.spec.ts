import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { AmaConfigTypeormEntity } from './typeorm/ama-config.typeorm-entity';
import { AmaCustomAppVerifier } from './ama-custom-app.verifier';
import { AmaTokenVerifyException } from './ama-token.verifier';

const SECRET = 'custom-app-hs256-secret-32bytes-min!!';
const ENTITY = '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b';

function makeToken(over: Record<string, unknown> = {}, signWith = SECRET): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: 'c31e3cc1-c8c2-4a9a-8dbb-c0c39d6b6570',
      email: 'fremd@naver.com',
      role: 'MASTER',
      entityId: ENTITY,
      scope: 'custom_app:context',
      appCode: 'tpi-acm',
      iat: now,
      exp: now + 3600,
      ...over,
    },
    signWith,
    { algorithm: 'HS256' },
  );
}

describe('AmaCustomAppVerifier (REQ-260609D)', () => {
  let svc: AmaCustomAppVerifier;
  let findOne: jest.Mock;

  const cfg = (over: Partial<AmaConfigTypeormEntity> = {}): AmaConfigTypeormEntity =>
    ({
      id: 'amc-1',
      entId: ENTITY,
      amaEntityId: ENTITY,
      appCode: 'tpi-acm',
      isActive: true,
      customAppSecretEnc: Buffer.from('enc'), // non-empty; decrypt is mocked
      expectedScope: 'custom_app:context',
    }) as AmaConfigTypeormEntity;

  const build = async () => {
    findOne = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        AmaCustomAppVerifier,
        { provide: getRepositoryToken(AmaConfigTypeormEntity, ACM_DS), useValue: { findOne } },
        // decrypt() always yields the known signing secret.
        { provide: AesGcmService, useValue: { decrypt: () => SECRET } },
      ],
    }).compile();
    svc = mod.get(AmaCustomAppVerifier);
  };

  it('verifies a correctly-signed token and returns payload', async () => {
    await build();
    findOne.mockResolvedValue(cfg());
    const p = await svc.verify(makeToken());
    expect(p.sub).toBe('c31e3cc1-c8c2-4a9a-8dbb-c0c39d6b6570');
    expect(p.email).toBe('fremd@naver.com');
    expect(p.role).toBe('MASTER');
    expect(p.entityId).toBe(ENTITY);
  });

  it('rejects a token signed with the wrong secret', async () => {
    await build();
    findOne.mockResolvedValue(cfg());
    await expect(svc.verify(makeToken({}, 'wrong-secret'))).rejects.toMatchObject({
      code: 'AMA_TOKEN_INVALID_SIGNATURE',
    } as Partial<AmaTokenVerifyException>);
  });

  it('denies when no active config for the entityId', async () => {
    await build();
    findOne.mockResolvedValue(null);
    await expect(svc.verify(makeToken())).rejects.toMatchObject({
      response: { code: 'ENTITY_NOT_ALLOWED' },
    } as Partial<HttpException>);
  });

  it('returns 503 when secret is not configured', async () => {
    await build();
    findOne.mockResolvedValue({
      id: 'amc-1',
      entId: ENTITY,
      amaEntityId: ENTITY,
      appCode: 'tpi-acm',
      isActive: true,
      customAppSecretEnc: null,
      expectedScope: 'custom_app:context',
    } as AmaConfigTypeormEntity);
    await expect(svc.verify(makeToken())).rejects.toMatchObject({
      response: { code: 'AMA_SSO_NOT_CONFIGURED' },
    } as Partial<HttpException>);
  });

  it('rejects on scope mismatch', async () => {
    await build();
    findOne.mockResolvedValue({
      id: 'amc-1',
      entId: ENTITY,
      amaEntityId: ENTITY,
      appCode: 'tpi-acm',
      isActive: true,
      customAppSecretEnc: Buffer.from('enc'),
      expectedScope: 'app_store:context',
    } as AmaConfigTypeormEntity);
    await expect(svc.verify(makeToken())).rejects.toMatchObject({
      code: 'AMA_TOKEN_SCOPE_INVALID',
    } as Partial<AmaTokenVerifyException>);
  });
});
