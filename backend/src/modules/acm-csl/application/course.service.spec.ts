import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { CourseTypeormEntity } from '../infrastructure/typeorm/course.typeorm-entity';
import { CourseService } from './course.service';

/**
 * REQ-260626 FR-CSL-132 — per-tenant course master. Code is normalized
 * to upper-case + trimmed on create, so 'map' and 'MAP' don't end up
 * as duplicate rows. uq(ent_id, code) is enforced both at the SQL
 * level and via the in-service pre-check.
 */
describe('CourseService', () => {
  let svc: CourseService;
  let find: jest.Mock;
  let findOne: jest.Mock;
  let create: jest.Mock;
  let save: jest.Mock;

  beforeEach(async () => {
    find = jest.fn().mockResolvedValue([]);
    findOne = jest.fn();
    create = jest.fn((row) => row);
    save = jest.fn((row) => Promise.resolve({ id: 'crs-1', ...row }));

    const mod = await Test.createTestingModule({
      providers: [
        CourseService,
        {
          provide: getRepositoryToken(CourseTypeormEntity, ACM_DS),
          useValue: { find, findOne, create, save },
        },
      ],
    }).compile();

    svc = mod.get(CourseService);
  });

  it('create — normalizes code to UPPER and trims name', async () => {
    findOne.mockResolvedValueOnce(null);
    await svc.create({ entId: 'e1', code: '  map  ', name: '  MAP Tutoring  ' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MAP', name: 'MAP Tutoring', isActive: true }),
    );
  });

  it('create — 409 when (entId, code) already exists', async () => {
    findOne.mockResolvedValueOnce({ id: 'existing', code: 'MAP', entId: 'e1' });
    await expect(
      svc.create({ entId: 'e1', code: 'map', name: 'MAP' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });

  it('list — default excludes inactive; includeInactive=true shows all', async () => {
    await svc.list('e1');
    expect(find).toHaveBeenLastCalledWith({
      where: { entId: 'e1', isActive: true },
      order: { code: 'ASC' },
    });
    await svc.list('e1', true);
    expect(find).toHaveBeenLastCalledWith({
      where: { entId: 'e1' },
      order: { code: 'ASC' },
    });
  });

  it('update — 404 when row missing in tenant', async () => {
    findOne.mockResolvedValueOnce(null);
    await expect(
      svc.update('e1', 'missing', { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update — patches name + isActive when provided', async () => {
    findOne.mockResolvedValueOnce({
      id: 'crs-1', entId: 'e1', code: 'MAP', name: 'old', isActive: true,
    });
    await svc.update('e1', 'crs-1', { name: '  new  ', isActive: false });
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'new', isActive: false }),
    );
  });
});
