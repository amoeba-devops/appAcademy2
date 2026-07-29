import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { ClassTypeormEntity } from '../../acm-cls/infrastructure/typeorm/class.typeorm-entity';
import { ClassStudentTypeormEntity } from '../../acm-cls/infrastructure/typeorm/class-student.typeorm-entity';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import { CalInviteeTypeormEntity } from '../infrastructure/typeorm/cal-invitee.typeorm-entity';
import { InviteeSuggestionsService } from './invitee-suggestions.service';

/**
 * Behaviors covered:
 *  1. Class members only — returns all with reason=CLASS, ordered by membership
 *  2. Recent invitees only — sorted by frequency desc, reason=RECENT
 *  3. Overlap — CLASS wins over RECENT for the same student
 *  4. Limit truncates result
 */
describe('InviteeSuggestionsService', () => {
  let svc: InviteeSuggestionsService;
  let stdFind: jest.Mock;
  let clsQb: {
    getMany: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    select: jest.Mock;
  };
  let cstFind: jest.Mock;
  let evtQb: {
    getMany: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    select: jest.Mock;
  };
  let invQb: {
    getMany: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    select: jest.Mock;
  };

  beforeEach(async () => {
    stdFind = jest.fn();
    cstFind = jest.fn();

    // Fluent QueryBuilder mocks — every chained call returns `this`.
    const makeQb = () => {
      const obj: Record<string, jest.Mock> = {
        select: jest.fn(),
        where: jest.fn(),
        andWhere: jest.fn(),
        getMany: jest.fn(),
      };
      obj.select.mockReturnValue(obj);
      obj.where.mockReturnValue(obj);
      obj.andWhere.mockReturnValue(obj);
      return obj as typeof obj & { getMany: jest.Mock };
    };
    clsQb = makeQb() as never;
    evtQb = makeQb() as never;
    invQb = makeQb() as never;

    const mod = await Test.createTestingModule({
      providers: [
        InviteeSuggestionsService,
        {
          provide: getRepositoryToken(StudentTypeormEntity, ACM_DS),
          useValue: { find: stdFind },
        },
        {
          provide: getRepositoryToken(ClassTypeormEntity, ACM_DS),
          useValue: { createQueryBuilder: jest.fn(() => clsQb) },
        },
        {
          provide: getRepositoryToken(ClassStudentTypeormEntity, ACM_DS),
          useValue: { find: cstFind },
        },
        {
          provide: getRepositoryToken(CalEventTypeormEntity, ACM_DS),
          useValue: { createQueryBuilder: jest.fn(() => evtQb) },
        },
        {
          provide: getRepositoryToken(CalInviteeTypeormEntity, ACM_DS),
          useValue: { createQueryBuilder: jest.fn(() => invQb) },
        },
      ],
    }).compile();
    svc = mod.get(InviteeSuggestionsService);
  });

  it('class-members-only path returns reason=CLASS with class label', async () => {
    clsQb.getMany.mockResolvedValue([
      { id: 'cls-1', code: 'M3-A', subjectLabel: '중3 영어 A' },
    ]);
    cstFind.mockResolvedValue([
      { clsId: 'cls-1', studentUserId: 'std-1' },
      { clsId: 'cls-1', studentUserId: 'std-2' },
    ]);
    stdFind.mockResolvedValueOnce([
      { id: 'std-1', name: '박학생' },
      { id: 'std-2', name: '이학생' },
    ]);
    // recent invitees branch returns empty
    evtQb.getMany.mockResolvedValue([]);

    const r = await svc.suggest({
      entId: 'ent-1',
      actorUserId: 'u-teacher',
      actorRole: 'TEACHER',
    });

    expect(r).toHaveLength(2);
    expect(r.every((x) => x.reason === 'CLASS')).toBe(true);
    expect(r.map((x) => x.refId).sort()).toEqual(['std-1', 'std-2']);
    expect(r[0].subLabel).toBe('중3 영어 A');
  });

  it('recent-only path is sorted by frequency desc', async () => {
    clsQb.getMany.mockResolvedValue([]); // no classes taught
    evtQb.getMany.mockResolvedValue([{ id: 'evt-1' }, { id: 'evt-2' }]);
    invQb.getMany.mockResolvedValue([
      { refId: 'std-a', kind: 'STUDENT' },
      { refId: 'std-a', kind: 'STUDENT' }, // 2 occurrences
      { refId: 'std-b', kind: 'STUDENT' },
      { refId: 'std-c', kind: 'STUDENT' }, // 1 each
    ]);
    stdFind.mockResolvedValueOnce([
      { id: 'std-a', name: 'A' },
      { id: 'std-b', name: 'B' },
      { id: 'std-c', name: 'C' },
    ]);

    const r = await svc.suggest({
      entId: 'ent-1',
      actorUserId: 'u-teacher',
      actorRole: 'TEACHER',
    });

    expect(r.map((x) => x.refId)).toEqual(['std-a', 'std-b', 'std-c']);
    expect(r.every((x) => x.reason === 'RECENT')).toBe(true);
    expect(r[0].subLabel).toBe('최근');
  });

  it('overlap: CLASS reason wins over RECENT for the same student', async () => {
    clsQb.getMany.mockResolvedValue([
      { id: 'cls-1', code: 'X', subjectLabel: 'X 클래스' },
    ]);
    cstFind.mockResolvedValue([{ clsId: 'cls-1', studentUserId: 'std-1' }]);
    stdFind
      .mockResolvedValueOnce([{ id: 'std-1', name: '박학생' }]) // for class members
      .mockResolvedValueOnce([
        { id: 'std-1', name: '박학생' },
        { id: 'std-2', name: '이학생' },
      ]); // for recent invitees

    evtQb.getMany.mockResolvedValue([{ id: 'evt-1' }]);
    invQb.getMany.mockResolvedValue([
      { refId: 'std-1', kind: 'STUDENT' }, // overlap
      { refId: 'std-2', kind: 'STUDENT' },
    ]);

    const r = await svc.suggest({
      entId: 'ent-1',
      actorUserId: 'u-teacher',
      actorRole: 'TEACHER',
    });

    const std1 = r.find((x) => x.refId === 'std-1');
    const std2 = r.find((x) => x.refId === 'std-2');
    expect(std1?.reason).toBe('CLASS');
    expect(std2?.reason).toBe('RECENT');
    expect(r).toHaveLength(2);
  });

  it('limit truncates to N entries', async () => {
    clsQb.getMany.mockResolvedValue([
      { id: 'cls-1', code: 'X', subjectLabel: 'X' },
    ]);
    cstFind.mockResolvedValue([
      { clsId: 'cls-1', studentUserId: 's1' },
      { clsId: 'cls-1', studentUserId: 's2' },
      { clsId: 'cls-1', studentUserId: 's3' },
      { clsId: 'cls-1', studentUserId: 's4' },
    ]);
    stdFind.mockResolvedValueOnce([
      { id: 's1', name: 'A' },
      { id: 's2', name: 'B' },
      { id: 's3', name: 'C' },
      { id: 's4', name: 'D' },
    ]);
    evtQb.getMany.mockResolvedValue([]);

    const r = await svc.suggest({
      entId: 'ent-1',
      actorUserId: 'u-teacher',
      actorRole: 'TEACHER',
      limit: 2,
    });

    expect(r).toHaveLength(2);
  });
});
