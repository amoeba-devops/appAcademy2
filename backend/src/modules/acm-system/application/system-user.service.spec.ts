import { Repository } from 'typeorm';
import { HttpException } from '@nestjs/common';
import { SystemUserService } from './system-user.service';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import type { AcmAuthService } from '../../acm-auth/application/acm-auth.service';

function makeUser(over: Partial<AcmUserTypeormEntity> = {}): AcmUserTypeormEntity {
  return {
    id: 'u1',
    entId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@amoeba.group',
    passwordHash: 'hash',
    name: 'Amoeba',
    status: 'ACTIVE',
    role: 'APP_ADMIN',
    authSource: 'local',
    lockedAt: null,
    lastLoginAt: null,
    createdAt: new Date('2026-06-21T00:00:00Z'),
    updatedAt: new Date('2026-06-21T00:00:00Z'),
  } as AcmUserTypeormEntity;
}

describe('SystemUserService', () => {
  let repo: jest.Mocked<Repository<AcmUserTypeormEntity>>;
  let auth: jest.Mocked<AcmAuthService>;
  let svc: SystemUserService;
  let qb: { andWhere: jest.Mock; orderBy: jest.Mock; skip: jest.Mock; take: jest.Mock; getManyAndCount: jest.Mock };

  beforeEach(() => {
    qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    repo = {
      findOne: jest.fn(),
      save: jest.fn((x: unknown) => x),
      createQueryBuilder: jest.fn(() => qb),
    } as unknown as jest.Mocked<Repository<AcmUserTypeormEntity>>;
    auth = {
      createUserWithPassword: jest.fn(),
      updateUserPassword: jest.fn(),
      lockUser: jest.fn(),
      unlockUser: jest.fn(),
    } as unknown as jest.Mocked<AcmAuthService>;
    svc = new SystemUserService(repo, auth);
  });

  it('list returns paginated items across tenants ({ items, total, page, limit })', async () => {
    qb.getManyAndCount.mockResolvedValueOnce([[makeUser()], 1]);
    const res = await svc.list({ page: '1', limit: '20' });
    expect(res.total).toBe(1);
    expect(res.page).toBe(1);
    expect(res.items[0].role).toBe('APP_ADMIN');
    // No ent_id scoping is applied for an unfiltered system query.
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('create delegates to AcmAuthService.createUserWithPassword then returns the view', async () => {
    auth.createUserWithPassword.mockResolvedValueOnce({ id: 'u1' });
    repo.findOne.mockResolvedValueOnce(makeUser());
    const res = await svc.create({
      entId: '00000000-0000-0000-0000-000000000001',
      email: 'admin@amoeba.group',
      name: 'Amoeba',
      password: 'temp@2026',
      role: 'APP_ADMIN',
    });
    expect(auth.createUserWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'APP_ADMIN', email: 'admin@amoeba.group' }),
    );
    expect(res.id).toBe('u1');
  });

  it('update mutates name/role/status', async () => {
    repo.findOne.mockResolvedValueOnce(makeUser());
    const res = await svc.update('u1', { name: 'New', role: 'ADMIN', status: 'INACTIVE' });
    expect(res.name).toBe('New');
    expect(res.role).toBe('ADMIN');
    expect(res.status).toBe('INACTIVE');
    expect(repo.save).toHaveBeenCalled();
  });

  it('update throws 404 when user missing', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(svc.update('missing', { name: 'x' })).rejects.toBeInstanceOf(HttpException);
  });

  it('lock delegates to AcmAuthService.lockUser', async () => {
    repo.findOne.mockResolvedValue(makeUser({ lockedAt: new Date() }));
    await svc.lock('u1');
    expect(auth.lockUser).toHaveBeenCalledWith('u1');
  });
});
