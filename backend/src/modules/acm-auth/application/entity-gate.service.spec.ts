import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException } from '@nestjs/common';
import { AcademyEntity } from '../../../infrastructure/database/entities/academy.entity';
import { EntityGateService } from './entity-gate.service';

describe('EntityGateService (REQ-260609 FR-A)', () => {
  let svc: EntityGateService;
  let findOne: jest.Mock;

  const build = async (allowed = 'VN3040') => {
    findOne = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        EntityGateService,
        { provide: getRepositoryToken(AcademyEntity), useValue: { findOne } },
        {
          provide: ConfigService,
          useValue: { get: (_k: string, d?: string) => allowed ?? d },
        },
      ],
    }).compile();
    svc = mod.get(EntityGateService);
  };

  const academy = (code: string | null): AcademyEntity =>
    ({ acdId: 1, acdAmaTenantId: 'ent-uuid', acdAmaEntityCode: code }) as AcademyEntity;

  it('allows a VN3040 academy', async () => {
    await build();
    findOne.mockResolvedValue(academy('VN3040'));
    await expect(svc.ensureAllowed('ent-uuid')).resolves.toBeUndefined();
  });

  it('allows case-insensitively', async () => {
    await build();
    findOne.mockResolvedValue(academy('vn3040'));
    await expect(svc.ensureAllowed('ent-uuid')).resolves.toBeUndefined();
  });

  it('denies when academy not found', async () => {
    await build();
    findOne.mockResolvedValue(null);
    await expect(svc.ensureAllowed('other')).rejects.toMatchObject({
      response: { code: 'ENTITY_NOT_ALLOWED' },
    } as Partial<HttpException>);
  });

  it('denies when code missing', async () => {
    await build();
    findOne.mockResolvedValue(academy(null));
    await expect(svc.ensureAllowed('ent-uuid')).rejects.toBeInstanceOf(HttpException);
  });

  it('denies a non-whitelisted code', async () => {
    await build();
    findOne.mockResolvedValue(academy('ZZ9999'));
    await expect(svc.ensureAllowed('ent-uuid')).rejects.toBeInstanceOf(HttpException);
  });

  it('cross-checks token entity code claim (FR-A3) — mismatch denied', async () => {
    await build();
    findOne.mockResolvedValue(academy('VN3040'));
    await expect(svc.ensureAllowed('ent-uuid', 'VN9999')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('passes when token claim matches stored code', async () => {
    await build();
    findOne.mockResolvedValue(academy('VN3040'));
    await expect(svc.ensureAllowed('ent-uuid', 'vn3040')).resolves.toBeUndefined();
  });
});
