import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { TeacherAssignmentTypeormEntity } from '../infrastructure/typeorm/teacher-assignment.typeorm-entity';
import { TeacherAssignmentService } from './teacher-assignment.service';

/**
 * REQ-260626 FR-CSL-136 — assign/upgrade/remove. The (inq, tch) UNIQUE
 * constraint shouldn't surface as a 409 on idempotent re-assign — the
 * second call is treated as a role upgrade/downgrade.
 */
describe('TeacherAssignmentService', () => {
  let svc: TeacherAssignmentService;
  let findOne: jest.Mock;
  let find: jest.Mock;
  let create: jest.Mock;
  let save: jest.Mock;
  let del: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn();
    find = jest.fn().mockResolvedValue([]);
    create = jest.fn((row) => row);
    save = jest.fn((row) => Promise.resolve({ id: 'asg-1', ...row }));
    del = jest.fn().mockResolvedValue({ affected: 1 });

    const mod = await Test.createTestingModule({
      providers: [
        TeacherAssignmentService,
        {
          provide: getRepositoryToken(TeacherAssignmentTypeormEntity, ACM_DS),
          useValue: { findOne, find, create, save, delete: del },
        },
      ],
    }).compile();

    svc = mod.get(TeacherAssignmentService);
  });

  it('assign — first time inserts a fresh row with the requested role', async () => {
    findOne.mockResolvedValueOnce(null);
    await svc.assign({
      entId: 'e1', inqId: 'i1', teacherId: 't1', role: 'PRIMARY', actorId: 'u1',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        entId: 'e1', inqId: 'i1', teacherId: 't1', role: 'PRIMARY', assignedBy: 'u1',
      }),
    );
    expect(save).toHaveBeenCalled();
  });

  it('assign — second call with same (inq, tch) upgrades the role (idempotent)', async () => {
    findOne.mockResolvedValueOnce({
      id: 'asg-1', entId: 'e1', inqId: 'i1', teacherId: 't1', role: 'PRIMARY',
    });
    await svc.assign({
      entId: 'e1', inqId: 'i1', teacherId: 't1', role: 'SECONDARY', actorId: 'u2',
    });
    expect(create).not.toHaveBeenCalled();
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'asg-1', role: 'SECONDARY', assignedBy: 'u2' }),
    );
  });

  it('remove — 404 when row not found in tenant', async () => {
    findOne.mockResolvedValueOnce(null);
    await expect(svc.remove('e1', 'i1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });

  it('remove — deletes by id when found', async () => {
    findOne.mockResolvedValueOnce({ id: 'asg-1', entId: 'e1', inqId: 'i1' });
    await svc.remove('e1', 'i1', 'asg-1');
    expect(del).toHaveBeenCalledWith({ id: 'asg-1' });
  });

  it('list — orders by role asc then assignedAt asc, scoped to tenant + inquiry', async () => {
    await svc.list('e1', 'i1');
    expect(find).toHaveBeenCalledWith({
      where: { entId: 'e1', inqId: 'i1' },
      order: { role: 'ASC', assignedAt: 'ASC' },
    });
  });
});
