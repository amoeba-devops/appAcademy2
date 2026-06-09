import { ConfigService } from '@nestjs/config';
import { TeacherSyncService } from './teacher-sync.service';
import type { IAmaClientService } from './interfaces/ama-client.interface';
import type { TeacherEntity } from '../../database/entities/teacher.entity';

function makeConfig(env: Record<string, unknown> = {}): ConfigService {
  return {
    get: (k: string, fb?: unknown) => env[k] ?? fb,
  } as unknown as ConfigService;
}

function makeRepo(initial: Partial<TeacherEntity>) {
  const teacher = { ...initial } as TeacherEntity;
  return {
    teacher,
    findOneOrFail: jest.fn().mockResolvedValue(teacher),
    find: jest.fn().mockResolvedValue([teacher]),
    save: jest.fn().mockImplementation(async (e: TeacherEntity) => {
      Object.assign(teacher, e);
      return teacher;
    }),
  };
}

describe('TeacherSyncService.syncOne', () => {
  it('marks teacher INACTIVE when AMA returns 404', async () => {
    const repo = makeRepo({
      tchId: 1,
      tchAmaClientId: 'CL-MISSING',
      tchStatus: 'ACTIVE',
    });
    const ama: jest.Mocked<IAmaClientService> = {
      getClient: jest.fn().mockResolvedValue(null),
      searchClients: jest.fn(),
      createClient: jest.fn(),
    };

    const svc = new TeacherSyncService(repo as any, ama, makeConfig());
    const result = await svc.syncOne(1);

    expect(ama.getClient).toHaveBeenCalledWith('CL-MISSING');
    expect(result.tchStatus).toBe('INACTIVE');
    expect(result.tchLastSyncedAt).toBeInstanceOf(Date);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('updates cached profile + lastSyncedAt on AMA hit', async () => {
    const repo = makeRepo({
      tchId: 7,
      tchAmaClientId: 'CL-2026-0001',
      tchStatus: 'ACTIVE',
    });
    const ama: jest.Mocked<IAmaClientService> = {
      getClient: jest.fn().mockResolvedValue({
        amaClientId: 'CL-2026-0001',
        name: '홍길동',
        phone: '010-1234-5678',
        email: 'hong@example.com',
        status: 'ACTIVE',
        employmentType: 'FULL_TIME',
        profileImageUrl: null,
        updatedAt: '2026-04-20T00:00:00Z',
      }),
      searchClients: jest.fn(),
      createClient: jest.fn(),
    };

    const svc = new TeacherSyncService(repo as any, ama, makeConfig());
    const result = await svc.syncOne(7);

    expect(result.tchStatus).toBe('ACTIVE');
    expect(result.tchLastSyncedAt).toBeInstanceOf(Date);
    const profile = result.tchCachedProfile as Record<string, unknown>;
    expect(profile.name).toBe('홍길동');
    expect(profile.phone).toBe('010-1234-5678');
    expect(profile.amaUpdatedAt).toBe('2026-04-20T00:00:00Z');
  });

  it('mirrors AMA INACTIVE/DELETED status locally', async () => {
    const repo = makeRepo({
      tchId: 9,
      tchAmaClientId: 'CL-2025-9999',
      tchStatus: 'ACTIVE',
    });
    const ama: jest.Mocked<IAmaClientService> = {
      getClient: jest.fn().mockResolvedValue({
        amaClientId: 'CL-2025-9999',
        name: '최퇴직',
        phone: null,
        email: null,
        status: 'INACTIVE',
        updatedAt: '2025-12-31T00:00:00Z',
      }),
      searchClients: jest.fn(),
      createClient: jest.fn(),
    };

    const svc = new TeacherSyncService(repo as any, ama, makeConfig());
    const result = await svc.syncOne(9);

    expect(result.tchStatus).toBe('INACTIVE');
  });
});
