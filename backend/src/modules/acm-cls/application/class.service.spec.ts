import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClassService } from './class.service';
import type { CreateClassDto, UpdateClassDto } from './dto/class.dto';

// Focused unit coverage for the class↔course link validation added in
// REQ-260706. Dependencies are mocked directly (plain class, no Nest DI) so
// the tests exercise only the branch logic in create()/update().

const ENT = '00000000-0000-0000-0000-000000000001';

function makeService() {
  const emRepo = {
    create: (x: unknown) => x,
    save: jest.fn(async (x: unknown) => x),
  };
  const em = { getRepository: jest.fn(() => emRepo) };

  const ds = {
    transaction: jest.fn(async (cb: (m: typeof em) => unknown) => cb(em)),
    // PLN-260719 D — resolveTeacherRef 의 tch 역조회 (legacy teacherUserId 경로).
    query: jest.fn().mockResolvedValue([]),
  } as any;

  const clsQb = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };
  const clsRepo = {
    findOne: jest.fn(),
    save: jest.fn(async (x: unknown) => x),
    createQueryBuilder: jest.fn(() => clsQb),
  } as any;

  const courseRepo = { exist: jest.fn() } as any;
  const events = { emit: jest.fn() } as any;
  const noop = {} as any;

  // Constructor order: ds, clsRepo, cstRepo, recRepo, vcfRepo, userRepo,
  // courseRepo, stdRepo, events.
  const svc = new ClassService(
    ds,
    clsRepo,
    noop,
    noop,
    noop,
    noop,
    courseRepo,
    noop,
    events,
  );
  return { svc, clsRepo, courseRepo, events };
}

function baseCreateDto(
  overrides: Partial<CreateClassDto> = {},
): CreateClassDto {
  return {
    subjectType: 'MAP_TEST',
    teacherUserId: 't-1',
    startedAt: '2026-07-01',
    students: [
      { studentUserId: 's-1', hourlyRate: 50000, capacityRole: 'PRIMARY' },
    ],
    recurrences: [{ dayOfWeek: 'MON', startTime: '10:00', durationMin: 60 }],
    ...overrides,
  };
}

describe('ClassService — course link validation', () => {
  describe('create()', () => {
    it('rejects an unknown / inactive course before any write', async () => {
      const { svc, courseRepo, clsRepo, events } = makeService();
      courseRepo.exist.mockResolvedValue(false);

      await expect(
        svc.create(ENT, baseCreateDto({ courseId: 'c-missing' })),
      ).rejects.toThrow(BadRequestException);

      // validation must only accept an active course in the same tenant
      expect(courseRepo.exist).toHaveBeenCalledWith({
        where: { entId: ENT, id: 'c-missing', isActive: true },
      });
      // failed before generating a code or opening the transaction
      expect(clsRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('persists courseId when the course is active', async () => {
      const { svc, courseRepo } = makeService();
      courseRepo.exist.mockResolvedValue(true);

      const res: any = await svc.create(
        ENT,
        baseCreateDto({ courseId: 'c-1' }),
      );

      expect(courseRepo.exist).toHaveBeenCalledTimes(1);
      expect(res.courseId).toBe('c-1');
    });

    it('skips course validation when no courseId is supplied', async () => {
      const { svc, courseRepo } = makeService();

      const res: any = await svc.create(ENT, baseCreateDto());

      expect(courseRepo.exist).not.toHaveBeenCalled();
      expect(res.courseId).toBeNull();
    });

    it('rejects when no PRIMARY student is present', async () => {
      const { svc } = makeService();
      await expect(
        svc.create(
          ENT,
          baseCreateDto({
            students: [
              {
                studentUserId: 's-1',
                hourlyRate: 50000,
                capacityRole: 'GROUP_PEER',
              },
            ],
          }),
        ),
      ).rejects.toThrow('VAL_NO_PRIMARY_STUDENT');
    });
  });

  describe('update()', () => {
    function existingClass() {
      return { id: 'cls-1', entId: ENT, courseId: 'c-old', deletedAt: null };
    }

    it('clears the link when courseId is null without validating', async () => {
      const { svc, clsRepo, courseRepo } = makeService();
      const c = existingClass();
      clsRepo.findOne.mockResolvedValue(c);

      const res: any = await svc.update(ENT, 'cls-1', {
        courseId: null,
      } as unknown as UpdateClassDto);

      expect(courseRepo.exist).not.toHaveBeenCalled();
      expect(res.courseId).toBeNull();
      expect(clsRepo.save).toHaveBeenCalledWith(c);
    });

    it('validates and sets the link when a courseId is supplied', async () => {
      const { svc, clsRepo, courseRepo } = makeService();
      clsRepo.findOne.mockResolvedValue(existingClass());
      courseRepo.exist.mockResolvedValue(true);

      const res: any = await svc.update(ENT, 'cls-1', { courseId: 'c-2' });

      expect(courseRepo.exist).toHaveBeenCalledWith({
        where: { entId: ENT, id: 'c-2', isActive: true },
      });
      expect(res.courseId).toBe('c-2');
    });

    it('rejects an unknown / inactive course on update', async () => {
      const { svc, clsRepo, courseRepo } = makeService();
      clsRepo.findOne.mockResolvedValue(existingClass());
      courseRepo.exist.mockResolvedValue(false);

      await expect(
        svc.update(ENT, 'cls-1', { courseId: 'c-bad' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('leaves the link untouched when courseId is omitted', async () => {
      const { svc, clsRepo, courseRepo } = makeService();
      clsRepo.findOne.mockResolvedValue(existingClass());

      const res: any = await svc.update(ENT, 'cls-1', { remark: 'x' });

      expect(courseRepo.exist).not.toHaveBeenCalled();
      expect(res.courseId).toBe('c-old');
    });

    it('throws NotFound when the class does not exist', async () => {
      const { svc, clsRepo } = makeService();
      clsRepo.findOne.mockResolvedValue(null);

      await expect(
        svc.update(ENT, 'missing', { courseId: 'c-2' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
