import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException } from '@nestjs/common';
import { ACM_DS } from '../../acm-common/datasource';
import { AmaConfigTypeormEntity } from '../infrastructure/typeorm/ama-config.typeorm-entity';
import { AmaConfigGateService } from './ama-config-gate.service';

describe('AmaConfigGateService (REQ-260609B FR-3)', () => {
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

  it('allows when entityId + appCode match an active config', async () => {
    await build();
    findOne.mockResolvedValue(cfg());
    await expect(svc.ensureAllowed('ent-uuid', 'tpi-acm')).resolves.toBeUndefined();
  });

  it('denies when no active config for the entityId (deny-all)', async () => {
    await build();
    findOne.mockResolvedValue(null);
    await expect(svc.ensureAllowed('other', 'tpi-acm')).rejects.toMatchObject({
      response: { code: 'ENTITY_NOT_ALLOWED' },
    } as Partial<HttpException>);
  });

  it('denies when appCode does not match', async () => {
    await build();
    findOne.mockResolvedValue(cfg({ appCode: 'tpi-acm' }));
    await expect(svc.ensureAllowed('ent-uuid', 'evil-app')).rejects.toMatchObject({
      response: { code: 'ENTITY_NOT_ALLOWED' },
    } as Partial<HttpException>);
  });

  it('queries only active rows (inactive config is invisible → denied)', async () => {
    await build();
    findOne.mockResolvedValue(null); // active:true filter yields nothing
    await expect(svc.ensureAllowed('ent-uuid', 'tpi-acm')).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { amaEntityId: 'ent-uuid', isActive: true },
    });
  });
});
