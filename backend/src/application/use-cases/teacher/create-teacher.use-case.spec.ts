import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateTeacherUseCase } from './create-teacher.use-case';
import type { ITeacherRepository } from '../../../domain/repositories/teacher-repository.interface';
import type { IAmaClientService } from '../../../infrastructure/external/ama/interfaces/ama-client.interface';
import type { CreateTeacherDto } from '../../dto/teacher';

describe('CreateTeacherUseCase', () => {
  const academyId = 1;
  const dto: CreateTeacherDto = {
    amaClientId: 'CL-2026-0001',
    employmentType: 'FULL_TIME',
    teachingSubjects: ['RC', 'Vocab'],
  } as CreateTeacherDto;

  function makeUseCase(opts: {
    amaClient: any;
    existing?: any;
    created?: any;
  }) {
    const ama: jest.Mocked<IAmaClientService> = {
      getClient: jest.fn().mockResolvedValue(opts.amaClient),
      searchClients: jest.fn(),
    };
    const repo: jest.Mocked<ITeacherRepository> = {
      findByAmaClientId: jest.fn().mockResolvedValue(opts.existing ?? null),
      create: jest.fn().mockResolvedValue(opts.created ?? null),
    } as unknown as jest.Mocked<ITeacherRepository>;
    const uc = new CreateTeacherUseCase(repo, ama);
    return { uc, ama, repo };
  }

  it('throws BadRequest with code AMA_CLIENT_NOT_FOUND when AMA returns null', async () => {
    const { uc, repo } = makeUseCase({ amaClient: null });
    await expect(uc.execute(academyId, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.findByAmaClientId).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('throws Conflict when teacher already exists', async () => {
    const { uc } = makeUseCase({
      amaClient: {
        amaClientId: 'CL-2026-0001',
        name: '홍길동',
        phone: '010-1234-5678',
        email: 'hong@example.com',
        status: 'ACTIVE',
        updatedAt: '2026-04-01T00:00:00Z',
      },
      existing: { id: 99, amaClientId: 'CL-2026-0001' },
    });
    await expect(uc.execute(academyId, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('persists with cached profile and lastSyncedAt on success', async () => {
    const amaClient = {
      amaClientId: 'CL-2026-0001',
      name: '홍길동',
      phone: '010-1234-5678',
      email: 'hong@example.com',
      status: 'ACTIVE',
      employmentType: 'FULL_TIME',
      profileImageUrl: null,
      updatedAt: '2026-04-01T00:00:00Z',
    };
    const created = {
      id: 1,
      amaClientId: 'CL-2026-0001',
      teachingSubjects: ['RC', 'Vocab'],
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      cachedProfile: { name: '홍길동', phone: '010-1234-5678' },
      lastSyncedAt: new Date('2026-04-20T00:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { uc, repo } = makeUseCase({ amaClient, created });

    const res = await uc.execute(academyId, dto);

    expect(repo.create).toHaveBeenCalledTimes(1);
    const arg = repo.create.mock.calls[0][0] as any;
    expect(arg.amaClientId).toBe('CL-2026-0001');
    expect(arg.cachedProfile.name).toBe('홍길동');
    expect(arg.cachedProfile.phone).toBe('010-1234-5678');
    expect(arg.lastSyncedAt).toBeInstanceOf(Date);

    expect(res.id).toBe(1);
    expect(res.cachedName).toBe('홍길동');
  });
});
