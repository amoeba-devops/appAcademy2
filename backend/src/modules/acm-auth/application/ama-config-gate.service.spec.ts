import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException } from '@nestjs/common';
import { ACM_DS } from '../../acm-common/datasource';
import { AmaConfigTypeormEntity } from '../infrastructure/typeorm/ama-config.typeorm-entity';
import { AmaConfigGateService } from './ama-config-gate.service';

describe('AmaConfigGateService (REQ-260609B / C D-1 — entityId-only gate)', () => {
  let svc: AmaConfigGateService;
  let findOne: jest.Mock;

  const build = async () => {
    findOne = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        AmaConfigGateService,
        {
          provide: getRepositoryToken(AmaConfigTypeormEntity, ACM_DS),
          useValue: { findOne },
        },
      ],
    }).compile();
    svc = mod.get(AmaConfigGateService);
  };

  const cfg = (over: Partial<AmaConfigTypeormEntity> = {}): AmaConfigTypeormEntity =>
    ({
      id: 'amc-1',
      entId: 'ent-uuid',
      amaEntityId: 'ent-uuid',
      appCode: 'tpi-acm',
      isActive: true,
      ...over,
    }) as AmaConfigTypeormEntity;

  it('allows and returns the config entId when entityId matches an active config', async () => {
    await build();
    findOne.mockResolvedValue(cfg());
    await expect(svc.ensureAllowed('ent-uuid')).resolves.toBe('ent-uuid');
  });

  it('returns the ACM entId, not the AMA entityId, when they diverge (FIX-260610)', async () => {
    await build();
    // TPI: ACM tenant 00000000-…01 mapped to AMA entityId 928f5fe4…
    findOne.mockResolvedValue(
      cfg({
        entId: '00000000-0000-0000-0000-000000000001',
        amaEntityId: '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b',
      }),
    );
    await expect(
      svc.ensureAllowed('928f5fe4-12ab-4113-b9b9-d8d455ca4e3b'),
    ).resolves.toBe('00000000-0000-0000-0000-000000000001');
  });

  it('denies when no active config for the entityId (deny-all)', async () => {
    await build();
    findOne.mockResolvedValue(null);
    await expect(svc.ensureAllowed('other')).rejects.toMatchObject({
      response: { code: 'ENTITY_NOT_ALLOWED' },
    } as Partial<HttpException>);
  });

  it('appCode is NOT part of the gate (D-1) — any appCode in config is irrelevant', async () => {
    await build();
    findOne.mockResolvedValue(cfg({ appCode: 'whatever-app' }));
    await expect(svc.ensureAllowed('ent-uuid')).resolves.toBe('ent-uuid');
  });

  it('queries only active rows by entityId', async () => {
    await build();
    findOne.mockResolvedValue(null);
    await expect(svc.ensureAllowed('ent-uuid')).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { amaEntityId: 'ent-uuid', isActive: true },
    });
  });
});
