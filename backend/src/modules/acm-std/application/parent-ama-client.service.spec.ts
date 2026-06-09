import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, UnprocessableEntityException } from '@nestjs/common';
import { ACM_DS } from '../../acm-common/datasource';
import { AMA_CLIENT_SERVICE } from '../../../infrastructure/external/ama/interfaces/ama-client.interface';
import { AmaServiceUnavailableException } from '../../../infrastructure/external/ama/ama.exceptions';
import { ParentTypeormEntity } from '../infrastructure/typeorm/parent.typeorm-entity';
import { StudentParentTypeormEntity } from '../infrastructure/typeorm/student-parent.typeorm-entity';
import { StudentTypeormEntity } from '../infrastructure/typeorm/student.typeorm-entity';
import { ParentService } from './parent.service';

/**
 * REQ-260609 FR-C — registerAsAmaClient: eligibility (ACTIVE student),
 * idempotency, and AMA failure handling.
 */
describe('ParentService.registerAsAmaClient', () => {
  let svc: ParentService;
  let parentFindOne: jest.Mock;
  let parentSave: jest.Mock;
  let linksFind: jest.Mock;
  let studentCount: jest.Mock;
  let createClient: jest.Mock;

  const ENT = 'ent-vn3040';

  beforeEach(async () => {
    parentFindOne = jest.fn();
    parentSave = jest.fn(async (p) => p);
    linksFind = jest.fn();
    studentCount = jest.fn();
    createClient = jest.fn();

    const mod = await Test.createTestingModule({
      providers: [
        ParentService,
        { provide: getRepositoryToken(ParentTypeormEntity, ACM_DS), useValue: { findOne: parentFindOne, save: parentSave } },
        { provide: getRepositoryToken(StudentParentTypeormEntity, ACM_DS), useValue: { find: linksFind } },
        { provide: getRepositoryToken(StudentTypeormEntity, ACM_DS), useValue: { count: studentCount } },
        { provide: getDataSourceToken(ACM_DS), useValue: {} },
        { provide: AMA_CLIENT_SERVICE, useValue: { createClient } },
      ],
    }).compile();
    svc = mod.get(ParentService);
  });

  const parent = (over: Partial<ParentTypeormEntity> = {}): ParentTypeormEntity =>
    ({ id: 'par-1', entId: ENT, name: '박철수', phone: '010', email: 'p@x.com', amaClientId: null, ...over }) as ParentTypeormEntity;

  it('404 when parent not found', async () => {
    parentFindOne.mockResolvedValue(null);
    await expect(svc.registerAsAmaClient(ENT, 'par-1')).rejects.toThrow();
  });

  it('idempotent — already registered returns existing without POST', async () => {
    parentFindOne.mockResolvedValue(parent({ amaClientId: 'CL-2026-0042' }));
    const res = await svc.registerAsAmaClient(ENT, 'par-1');
    expect(res).toEqual({ amaClientId: 'CL-2026-0042', alreadyRegistered: true });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('422 NO_ACTIVE_STUDENT when no ACTIVE student', async () => {
    parentFindOne.mockResolvedValue(parent());
    linksFind.mockResolvedValue([{ stdId: 's1' }]);
    studentCount.mockResolvedValue(0);
    await expect(svc.registerAsAmaClient(ENT, 'par-1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it('registers when ACTIVE student exists; persists client id', async () => {
    const p = parent();
    parentFindOne.mockResolvedValue(p);
    linksFind.mockResolvedValue([{ stdId: 's1' }]);
    studentCount.mockResolvedValue(1);
    createClient.mockResolvedValue({ amaClientId: 'CL-MOCK-1001', name: '박철수' });

    const res = await svc.registerAsAmaClient(ENT, 'par-1');

    expect(createClient).toHaveBeenCalledWith({
      entityId: ENT,
      name: '박철수',
      phone: '010',
      email: 'p@x.com',
    });
    expect(res).toEqual({ amaClientId: 'CL-MOCK-1001', alreadyRegistered: false });
    expect(p.amaClientId).toBe('CL-MOCK-1001');
    expect(p.amaRegisteredAt).toBeInstanceOf(Date);
    expect(parentSave).toHaveBeenCalledWith(p);
  });

  it('maps AMA unavailable to 503', async () => {
    parentFindOne.mockResolvedValue(parent());
    linksFind.mockResolvedValue([{ stdId: 's1' }]);
    studentCount.mockResolvedValue(1);
    createClient.mockRejectedValue(new AmaServiceUnavailableException('down'));
    await expect(svc.registerAsAmaClient(ENT, 'par-1')).rejects.toMatchObject({
      response: { code: 'AMA_UNAVAILABLE' },
    } as Partial<HttpException>);
  });
});
