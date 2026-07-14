import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException } from '@nestjs/common';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmTenantTypeormEntity } from '../../acm-system/infrastructure/typeorm/acm-tenant.typeorm-entity';
import { AmaConfigTypeormEntity } from '../infrastructure/typeorm/ama-config.typeorm-entity';
import { EntityGateService } from './entity-gate.service';

describe('EntityGateService (REQ-260609 FR-A)', () => {
  let svc: EntityGateService;
  let amaConfigFindOne: jest.Mock;
  let tenantFindOne: jest.Mock;

  const build = async (allowed = 'VN3040') => {
    amaConfigFindOne = jest.fn().mockResolvedValue({
      entId: 'tenant-uuid',
      amaEntityId: 'ent-uuid',
      isActive: true,
    });
    tenantFindOne = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        EntityGateService,
        {
          provide: getRepositoryToken(AmaConfigTypeormEntity, ACM_DS),
          useValue: { findOne: amaConfigFindOne },
        },
        {
          provide: getRepositoryToken(AcmTenantTypeormEntity, ACM_DS),
          useValue: { findOne: tenantFindOne },
        },
        {
          provide: ConfigService,
          useValue: { get: (_k: string, d?: string) => allowed ?? d },
        },
      ],
    }).compile();
    svc = mod.get(EntityGateService);
  };

  const tenant = (code: string | null): AcmTenantTypeormEntity =>
    ({ entId: 'tenant-uuid', amaEntityCode: code }) as AcmTenantTypeormEntity;

  it('allows a VN3040 tenant', async () => {
    await build();
    tenantFindOne.mockResolvedValue(tenant('VN3040'));
    await expect(svc.ensureAllowed('ent-uuid')).resolves.toBeUndefined();
  });

  it('allows case-insensitively', async () => {
    await build();
    tenantFindOne.mockResolvedValue(tenant('vn3040'));
    await expect(svc.ensureAllowed('ent-uuid')).resolves.toBeUndefined();
  });

  it('denies when active AMA config not found', async () => {
    await build();
    amaConfigFindOne.mockResolvedValue(null);
    await expect(svc.ensureAllowed('other')).rejects.toMatchObject({
      response: { code: 'ENTITY_NOT_ALLOWED' },
    } as Partial<HttpException>);
  });

  it('allows when no code is known (nothing to whitelist-check)', async () => {
    // Fail-open on missing code: with neither a stored nor a token code there
    // is nothing to check against the whitelist, so the gate does not block.
    await build();
    tenantFindOne.mockResolvedValue(tenant(null));
    await expect(svc.ensureAllowed('ent-uuid')).resolves.toBeUndefined();
  });

  it('denies a non-whitelisted code', async () => {
    await build();
    tenantFindOne.mockResolvedValue(tenant('ZZ9999'));
    await expect(svc.ensureAllowed('ent-uuid')).rejects.toBeInstanceOf(HttpException);
  });

  it('cross-checks token entity code claim (FR-A3) — mismatch denied', async () => {
    await build();
    tenantFindOne.mockResolvedValue(tenant('VN3040'));
    await expect(svc.ensureAllowed('ent-uuid', 'VN9999')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('passes when token claim matches stored code', async () => {
    await build();
    tenantFindOne.mockResolvedValue(tenant('VN3040'));
    await expect(svc.ensureAllowed('ent-uuid', 'vn3040')).resolves.toBeUndefined();
  });
});
