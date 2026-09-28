import { DataSource, EntityManager } from 'typeorm';
import { VideoConfigService } from './video-config.service';
import { CalVideoConfigTypeormEntity } from '../infrastructure/typeorm/video-config.typeorm-entity';

describe('tenant video policy', () => {
  const findOneBy = jest.fn();
  const upsert = jest.fn();
  const saveAudit = jest.fn();
  const query = jest.fn();
  const manager = {
    query: jest.fn(),
    getRepository: jest.fn((entity: unknown) =>
      entity === CalVideoConfigTypeormEntity
        ? { findOneBy, upsert }
        : { save: saveAudit },
    ),
  };
  const db = {
    query,
    getRepository: jest.fn(() => ({ findOneBy })),
    transaction: jest.fn(async (work: (m: EntityManager) => Promise<unknown>) =>
      work(manager as unknown as EntityManager),
    ),
  };
  let svc: VideoConfigService;
  beforeEach(() => {
    jest.clearAllMocks();
    findOneBy.mockResolvedValue(null);
    query.mockResolvedValue([{ active: false }]);
    svc = new (class extends VideoConfigService {
      protected async lockDatabase() {
        return db as unknown as DataSource;
      }
    })(db as unknown as DataSource);
  });
  it('defaults to BODA without disclosing connection settings', async () => {
    expect(await svc.get('tenant-a')).toEqual({
      provider: 'BODASCHOOL',
      bodaEnabled: true,
    });
    expect(findOneBy).toHaveBeenCalledWith({ entId: 'tenant-a' });
  });
  it('isolates providers by tenant and rejects disabled BODA', async () => {
    findOneBy.mockImplementation(async ({ entId }: { entId: string }) =>
      entId === 'tenant-a' ? { provider: 'GOOGLE_MEET' } : null,
    );
    await expect(svc.assertBoda('tenant-a')).rejects.toThrow(
      'VIDEO_PROVIDER_DISABLED',
    );
    await expect(svc.assertBoda('tenant-b')).resolves.toBeUndefined();
  });
  it('serializes settings with launch requests and audits the change', async () => {
    await svc.update('tenant-a', 'admin-id', 'GOOGLE_MEET');
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      ['cal-video:tenant-a'],
    );
    expect(upsert).toHaveBeenCalledWith(
      { entId: 'tenant-a', provider: 'GOOGLE_MEET' },
      ['entId'],
    );
    expect(saveAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entId: 'tenant-a',
        userId: 'admin-id',
        oldValue: 'BODASCHOOL',
        newValue: 'GOOGLE_MEET',
      }),
    );
  });
  it('refuses changes while a room or launch handoff is active', async () => {
    query.mockResolvedValue([{ active: true }]);
    await expect(
      svc.update('tenant-a', 'admin-id', 'GOOGLE_MEET'),
    ).rejects.toThrow('VIDEO_ACTIVE_ROOM');
    expect(upsert).not.toHaveBeenCalled();
    expect(saveAudit).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('vdc_boda_launch_until > NOW()'),
      ['tenant-a', null],
    );
  });
  it('does not deadlock when instant creation nests the tenant lock', async () => {
    expect(
      await svc.withLock('tenant-a', () =>
        svc.withLock('tenant-a', async () => 42),
      ),
    ).toBe(42);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
  it('scopes per-event conversion checks and reserves launch handoff', async () => {
    await svc.assertNoActiveRooms('tenant-a', 'event-a');
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      'tenant-a',
      'event-a',
    ]);
    await svc.reserveLaunch('tenant-a');
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("INTERVAL '2 minutes'"),
      ['tenant-a'],
    );
  });
});
