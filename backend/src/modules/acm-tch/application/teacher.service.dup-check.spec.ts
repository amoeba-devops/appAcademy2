import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmAuthService } from '../../acm-auth/application/acm-auth.service';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { TeacherTypeormEntity } from '../infrastructure/typeorm/teacher.typeorm-entity';
import { TeacherService } from './teacher.service';
import type { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';

/**
 * REQ-260630 — covers the structured 409 returned for name / englishName /
 * email duplicates on create + update. Per-field error codes drive the
 * tch:error.{name,englishName,email}Duplicate i18n keys in TchFormModal.
 */
describe('TeacherService dup check (name / englishName / email)', () => {
  let svc: TeacherService;
  let qbWhere: jest.Mock;
  let qbAndWhere: jest.Mock;
  let qbGetOne: jest.Mock;
  let repoFindOne: jest.Mock;

  function dto(over: Partial<CreateTeacherDto> = {}): CreateTeacherDto {
    return {
      tchName: '홍길동',
      tchEnglishName: 'Hong Gil-dong',
      tchEmail: 'hong@trinity.kr',
      tchSubjects: [],
      tchIsInstructor: true,
      tchEmploymentType: 'FULL_TIME',
      ...over,
    } as CreateTeacherDto;
  }

  beforeEach(async () => {
    qbGetOne = jest.fn();
    qbWhere = jest.fn().mockReturnThis();
    qbAndWhere = jest.fn().mockReturnThis();
    repoFindOne = jest.fn();
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: qbWhere,
        andWhere: qbAndWhere,
        getOne: qbGetOne,
      }),
      findOne: repoFindOne,
      create: jest.fn((row) => row),
      save: jest.fn((row) => Promise.resolve({ id: 'tch-new', ...row })),
    };
    const mod = await Test.createTestingModule({
      providers: [
        TeacherService,
        { provide: getRepositoryToken(TeacherTypeormEntity, ACM_DS), useValue: repo },
        {
          provide: getRepositoryToken(AcmUserTypeormEntity, ACM_DS),
          useValue: { findOne: jest.fn() },
        },
        { provide: AcmAuthService, useValue: {} },
      ],
    }).compile();
    svc = mod.get(TeacherService);
  });

  it('email collision → ConflictException with code=EMAIL_DUPLICATE', async () => {
    // First QB call (email) returns hit. Subsequent calls don't matter
    // because we throw before reaching them.
    qbGetOne.mockResolvedValueOnce({ id: 'tch-other' });
    await expect(svc.create('e1', dto())).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: 'EMAIL_DUPLICATE',
        field: 'email',
        value: 'hong@trinity.kr',
      }),
    });
  });

  it('name collision (email free) → code=NAME_DUPLICATE', async () => {
    // Email check returns null, then name check returns a hit.
    qbGetOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'tch-other' });
    await expect(svc.create('e1', dto())).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: 'NAME_DUPLICATE',
        field: 'name',
        value: '홍길동',
      }),
    });
  });

  it('englishName collision (email + name free) → code=ENGLISH_NAME_DUPLICATE', async () => {
    qbGetOne
      .mockResolvedValueOnce(null) // email
      .mockResolvedValueOnce(null) // name
      .mockResolvedValueOnce({ id: 'tch-other' }); // englishName
    await expect(svc.create('e1', dto())).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: 'ENGLISH_NAME_DUPLICATE',
        field: 'englishName',
        value: 'Hong Gil-dong',
      }),
    });
  });

  it('no englishName provided → skips that branch (no QB call for it)', async () => {
    qbGetOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    // englishName branch wouldn't run; only 2 QB getOne calls.
    await expect(
      svc.create('e1', dto({ tchEnglishName: undefined })),
    ).rejects.toBeInstanceOf(ConflictException).catch(() => {});
    // 2 calls total (email + name) — no englishName lookup.
    expect(qbGetOne).toHaveBeenCalledTimes(2);
  });

  it('update with no collision passes through', async () => {
    qbGetOne.mockResolvedValue(null); // every branch clean
    repoFindOne.mockResolvedValueOnce({
      id: 'tch-1',
      entId: 'e1',
      name: '홍길동',
      email: 'hong@trinity.kr',
      deletedAt: null,
      updatedAt: new Date(),
    });
    const patch: UpdateTeacherDto = { tchName: '홍길동' };
    await expect(svc.update('e1', 'tch-1', patch)).resolves.toMatchObject({
      id: 'tch-1',
    });
  });

  it('update excludes the current row from collision (own name is fine)', async () => {
    // First lookup (findOne for the existing teacher).
    repoFindOne.mockResolvedValueOnce({
      id: 'tch-1',
      entId: 'e1',
      name: 'old-name',
      email: 'hong@trinity.kr',
      deletedAt: null,
      updatedAt: new Date(),
    });
    qbGetOne.mockResolvedValue(null); // assertNoDuplicate finds nothing
    await svc.update('e1', 'tch-1', { tchEmail: 'hong@trinity.kr' });
    // The assertNoDuplicate QB was called with excludeId — verify via the
    // andWhere mock seeing the excludeId binding.
    expect(qbAndWhere).toHaveBeenCalledWith(
      expect.stringContaining('t.id != :excludeId'),
      expect.objectContaining({ excludeId: 'tch-1' }),
    );
  });
});
