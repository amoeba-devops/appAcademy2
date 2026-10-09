import { DataSource, EntityManager, Repository } from 'typeorm';
import { StudentService } from './student.service';
import { ParentService } from './parent.service';
import { StudentTypeormEntity } from '../infrastructure/typeorm/student.typeorm-entity';
import { TeacherTypeormEntity } from '../../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { StudentTeacherTypeormEntity } from '../infrastructure/typeorm/student-teacher.typeorm-entity';
jest.mock('./teacher-class-info', () => ({
  CLASS_FIELDS: [],
  saveClassInfos: jest.fn(),
  readClassInfos: jest.fn().mockResolvedValue({}),
}));
function setup(email: string | null = null) {
  const entity = {
    id: 'student',
    entId: 'tenant',
    name: 'Fixture',
    email,
    status: 'ACTIVE',
  };
  const qb = {
    withDeleted: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getExists: jest.fn().mockResolvedValue(false),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: object) => ({ ...entity, ...v })),
    findOne: jest.fn().mockResolvedValue(entity),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (v: object) => v),
  };
  const manager = {
    query: jest.fn().mockResolvedValue([]),
    getRepository: () => repo,
  };
  const ds = {
    manager,
    query: manager.query,
    transaction: (work: (m: EntityManager) => Promise<unknown>) =>
      work(manager as unknown as EntityManager),
  };
  const service = new StudentService(
    repo as unknown as Repository<StudentTypeormEntity>,
    {} as Repository<TeacherTypeormEntity>,
    {} as Repository<StudentTeacherTypeormEntity>,
    ds as unknown as DataSource,
    {
      listForStudent: jest.fn().mockResolvedValue([]),
    } as unknown as ParentService,
  );
  return { service, repo, qb };
}
describe('student email persistence', () => {
  it.each(['ACTIVE', 'INACTIVE', 'WITHDRAWN'] as const)(
    'registers %s students without email',
    async (stdStatus) => {
      const { service, repo } = setup();
      await service.create('tenant', {
        stdName: 'Fixture',
        stdSite: 'TPI',
        stdStatus,
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: null }),
      );
    },
  );
  it.each([null, 'saved@example.test'])(
    'preserves omitted email %p during other edits',
    async (email) => {
      const { service, repo } = setup(email);
      await service.update('tenant', 'student', { stdPhone: '123' });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email, phone: '123' }),
      );
    },
  );
  it.each([null, '', '  '])(
    'clears explicitly empty email %p',
    async (stdEmail) => {
      const { service, repo } = setup('saved@example.test');
      await service.update('tenant', 'student', { stdEmail });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: null }),
      );
    },
  );
  it('retains tenant-scoped duplicate protection on create and update', async () => {
    const { service, qb, repo } = setup();
    qb.getExists.mockResolvedValue(true);
    await expect(
      service.create('tenant', {
        stdName: 'Fixture',
        stdSite: 'TPI',
        stdEmail: 'used@example.test',
      }),
    ).rejects.toThrow('EMAIL_DUPLICATE');
    await expect(
      service.update('tenant', 'student', { stdEmail: 'used@example.test' }),
    ).rejects.toThrow('EMAIL_DUPLICATE');
    expect(qb.where).toHaveBeenCalledWith('s.entId = :entId', {
      entId: 'tenant',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('s.id != :excludeId', {
      excludeId: 'student',
    });
    expect(repo.save).not.toHaveBeenCalled();
  });
});
