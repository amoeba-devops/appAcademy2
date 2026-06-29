import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmAuthService } from '../../acm-auth/application/acm-auth.service';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { TeacherTypeormEntity } from '../infrastructure/typeorm/teacher.typeorm-entity';
import { TeacherService } from './teacher.service';

/**
 * REQ-260629 FR-303/305 — covers find-or-create semantics for
 * TeacherService.upsertFromAma. The race-condition branch uses a
 * deliberately staged findOne sequence.
 */
describe('TeacherService.upsertFromAma', () => {
  let svc: TeacherService;
  let repoFindOne: jest.Mock;
  let repoSave: jest.Mock;
  let repoCreate: jest.Mock;

  beforeEach(async () => {
    repoFindOne = jest.fn();
    repoSave = jest.fn();
    repoCreate = jest.fn().mockImplementation((row) => ({ ...row }));

    const mod = await Test.createTestingModule({
      providers: [
        TeacherService,
        {
          provide: getRepositoryToken(TeacherTypeormEntity, ACM_DS),
          useValue: {
            findOne: repoFindOne,
            save: repoSave,
            create: repoCreate,
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AcmUserTypeormEntity, ACM_DS),
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
        { provide: AcmAuthService, useValue: {} },
      ],
    }).compile();

    svc = mod.get(TeacherService);
  });

  it('rejects empty amaUserId', async () => {
    await expect(
      svc.upsertFromAma('e1', { amaUserId: '' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('existing row → returns its teacherId with created=false (no insert)', async () => {
    repoFindOne.mockResolvedValueOnce({ id: 'tch-1' } as TeacherTypeormEntity);
    const r = await svc.upsertFromAma('e1', { amaUserId: 'ama-1' });
    expect(r).toEqual({ teacherId: 'tch-1', created: false });
    expect(repoSave).not.toHaveBeenCalled();
  });

  it('happy path: no existing row + no email collision → creates row, returns created=true', async () => {
    // First call (lookup by amaUserId) → no hit.
    // Second call (email collision check) → no hit.
    repoFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    repoSave.mockResolvedValueOnce({ id: 'tch-new' });
    const r = await svc.upsertFromAma('e1', {
      amaUserId: 'ama-2',
      name: 'Kim Sun',
      email: 'kim@trinity.kr',
    });
    expect(r).toEqual({ teacherId: 'tch-new', created: true });
    expect(repoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entId: 'e1',
        name: 'Kim Sun',
        email: 'kim@trinity.kr',
        amaUserId: 'ama-2',
        status: 'ACTIVE',
        isInstructor: true,
      }),
    );
  });

  it('placeholders name + email when client omits them', async () => {
    repoFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    repoSave.mockResolvedValueOnce({ id: 'tch-3' });
    await svc.upsertFromAma('e1', { amaUserId: 'abcdef1234567890' });
    expect(repoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'AMA abcdef12',
        email: 'abcdef12@ama.invalid',
        amaUserId: 'abcdef1234567890',
      }),
    );
  });

  it('email collision with existing teacher → suffixes amaUserId prefix', async () => {
    // First findOne (ama lookup) → null
    repoFindOne.mockResolvedValueOnce(null);
    // Second findOne (email collision) → hit
    repoFindOne.mockResolvedValueOnce({ id: 'existing-by-email' });
    repoSave.mockResolvedValueOnce({ id: 'tch-collision' });
    await svc.upsertFromAma('e1', {
      amaUserId: 'fedc9876543210ab',
      email: 'shared@trinity.kr',
    });
    expect(repoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'fedc9876+shared@trinity.kr',
      }),
    );
  });

  it('UNIQUE violation on save → race winner re-fetched and returned with created=false', async () => {
    // No email provided → no email-collision findOne happens. So the 2nd
    // findOne call is the post-error re-read directly.
    repoFindOne
      .mockResolvedValueOnce(null) // initial ama lookup
      .mockResolvedValueOnce({ id: 'tch-racer' }); // post-error re-read
    repoSave.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key'), { code: '23505' }),
    );
    const r = await svc.upsertFromAma('e1', { amaUserId: 'ama-race' });
    expect(r).toEqual({ teacherId: 'tch-racer', created: false });
  });

  it('UNIQUE violation + post-error re-read STILL misses → rethrows', async () => {
    repoFindOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    repoSave.mockRejectedValueOnce(new Error('some other error'));
    await expect(
      svc.upsertFromAma('e1', { amaUserId: 'ama-strange' }),
    ).rejects.toThrow('some other error');
  });
});
