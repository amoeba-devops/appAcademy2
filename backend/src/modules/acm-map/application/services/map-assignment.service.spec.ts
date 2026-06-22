import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import {
  MapAssignmentTypeormEntity,
} from '../../infrastructure/typeorm/map-assignment.typeorm-entity';
import { MapResponseTypeormEntity } from '../../infrastructure/typeorm/map-response.typeorm-entity';
import { MapAssignmentService } from './map-assignment.service';

/**
 * Behaviors covered:
 *  1. create — defaults ASSIGNED status
 *  2. findById — NotFoundException when missing
 *  3. transition — status patches without other fields
 *  4. listForStudent — filters STUDENT/ASSIGNED only
 *  5. upsertResponse — first call inserts, second call (same triple) updates
 *     in place (idempotent grading retry)
 *  6. totalScore — sums pointsEarned, treats null as 0
 */
describe('MapAssignmentService', () => {
  let svc: MapAssignmentService;
  let asnFind: jest.Mock;
  let asnFindOne: jest.Mock;
  let asnSave: jest.Mock;
  let asnCreate: jest.Mock;
  let rspFind: jest.Mock;
  let rspFindOne: jest.Mock;
  let rspSave: jest.Mock;
  let rspCreate: jest.Mock;

  beforeEach(async () => {
    asnFind = jest.fn();
    asnFindOne = jest.fn();
    asnSave = jest.fn((row) => Promise.resolve({ id: 'asn-1', ...row }));
    asnCreate = jest.fn((row) => row);
    rspFind = jest.fn();
    rspFindOne = jest.fn();
    rspSave = jest.fn((row) => Promise.resolve({ id: 'rsp-1', ...row }));
    rspCreate = jest.fn((row) => row);

    const mod = await Test.createTestingModule({
      providers: [
        MapAssignmentService,
        {
          provide: getRepositoryToken(MapAssignmentTypeormEntity, ACM_DS),
          useValue: { find: asnFind, findOne: asnFindOne, save: asnSave, create: asnCreate },
        },
        {
          provide: getRepositoryToken(MapResponseTypeormEntity, ACM_DS),
          useValue: { find: rspFind, findOne: rspFindOne, save: rspSave, create: rspCreate },
        },
      ],
    }).compile();

    svc = mod.get(MapAssignmentService);
  });

  it('create defaults status to ASSIGNED', async () => {
    const dueAt = new Date('2026-07-01T00:00:00Z');
    await svc.create({
      testSetId: 'mts-1',
      targetType: 'STUDENT',
      targetId: 'std-1',
      dueAt,
    });
    expect(asnCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ASSIGNED', dueAt }),
    );
  });

  it('findById throws NotFoundException when missing', async () => {
    asnFindOne.mockResolvedValueOnce(null);
    await expect(svc.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('transition patches status', async () => {
    asnFindOne.mockResolvedValueOnce({ id: 'a1', status: 'ASSIGNED' });
    await svc.transition('a1', 'IN_PROGRESS');
    expect(asnSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', status: 'IN_PROGRESS' }),
    );
  });

  it('listForStudent filters STUDENT/ASSIGNED with dueAt ASC', async () => {
    asnFind.mockResolvedValueOnce([]);
    await svc.listForStudent('std-1');
    expect(asnFind).toHaveBeenCalledWith({
      where: { targetType: 'STUDENT', targetId: 'std-1', status: 'ASSIGNED' },
      order: { dueAt: 'ASC' },
    });
  });

  it('upsertResponse inserts on first call, updates on second (idempotent)', async () => {
    // First call — no existing row.
    rspFindOne.mockResolvedValueOnce(null);
    await svc.upsertResponse({
      assignmentId: 'a1',
      studentId: 's1',
      itemId: 'i1',
      answer: { choice: 'A' },
      isCorrect: false,
      pointsEarned: 0,
    });
    expect(rspCreate).toHaveBeenCalled();

    // Second call — existing row found; in-place update path.
    const existing = {
      id: 'r1', assignmentId: 'a1', studentId: 's1', itemId: 'i1',
      answer: { choice: 'A' }, isCorrect: false, pointsEarned: 0,
    };
    rspFindOne.mockResolvedValueOnce(existing);
    rspCreate.mockClear();
    await svc.upsertResponse({
      assignmentId: 'a1',
      studentId: 's1',
      itemId: 'i1',
      answer: { choice: 'B' },
      isCorrect: true,
      pointsEarned: 4,
    });
    expect(rspCreate).not.toHaveBeenCalled();
    expect(rspSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'r1',
        answer: { choice: 'B' },
        isCorrect: true,
        pointsEarned: 4,
      }),
    );
  });

  it('totalScore sums pointsEarned across responses (null → 0)', async () => {
    rspFind.mockResolvedValueOnce([
      { pointsEarned: 3 },
      { pointsEarned: 4 },
      { pointsEarned: null },
      { pointsEarned: 1 },
    ] as never);
    const total = await svc.totalScore('a1', 's1');
    expect(total).toBe(8);
  });
});
