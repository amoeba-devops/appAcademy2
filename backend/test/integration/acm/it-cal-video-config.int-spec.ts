import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { VideoConfigService } from '../../../src/modules/acm-cal/application/video-config.service';
import { CalVideoConfigTypeormEntity } from '../../../src/modules/acm-cal/infrastructure/typeorm/video-config.typeorm-entity';
import { AuditLogTypeormEntity } from '../../../src/modules/acm-audit/infrastructure/typeorm/audit-log.typeorm-entity';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const EVENT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
describe('video provider PostgreSQL integration', () => {
  let pg: StartedPostgreSqlContainer;
  let db: DataSource;
  let service: VideoConfigService;
  const migration = readFileSync(
    resolve(__dirname, '../../../../sql/acm/999t-acm-cal-video-config.sql'),
    'utf8',
  );
  beforeAll(async () => {
    pg = await new PostgreSqlContainer(
      process.env.ACM_TEST_PG_IMAGE ?? 'tac-postgres-acm:pg16-bigm',
    )
      .withDatabase('video_test')
      .withUsername('video_test')
      .withPassword('video_test')
      .withPullPolicy({ shouldPull: () => false })
      .start();
    db = await new DataSource({
      type: 'postgres',
      host: pg.getHost(),
      port: pg.getPort(),
      username: pg.getUsername(),
      password: pg.getPassword(),
      database: pg.getDatabase(),
      entities: [CalVideoConfigTypeormEntity, AuditLogTypeormEntity],
      synchronize: false,
    }).initialize();
    await db.query(`CREATE FUNCTION set_acm_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
      CREATE TABLE amb_acm_cal_boda_room (ent_id UUID, evt_id UUID, bdr_status VARCHAR(20));`);
    await db.query(
      readFileSync(
        resolve(__dirname, '../../../../sql/acm/965-acm-audit-log.sql'),
        'utf8',
      ),
    );
    await db.query(migration);
    service = new VideoConfigService(db);
  });
  afterAll(async () => {
    if (service) await service.onModuleDestroy();
    if (db?.isInitialized) await db.destroy();
    if (pg) await pg.stop();
  });
  beforeEach(async () => {
    await db.query(
      'TRUNCATE amb_acm_cal_video_config, amb_acm_cal_boda_room, amb_acm_audit_log',
    );
  });
  it('reapplies the migration without losing settings and isolates tenants', async () => {
    await service.update(A, USER, 'GOOGLE_MEET');
    await db.query(migration);
    expect(await service.get(A)).toEqual({
      provider: 'GOOGLE_MEET',
      bodaEnabled: false,
    });
    expect(await service.get(B)).toEqual({
      provider: 'BODASCHOOL',
      bodaEnabled: true,
    });
    const logs = await db.getRepository(AuditLogTypeormEntity).find();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      entId: A,
      userId: USER,
      newValue: 'GOOGLE_MEET',
    });
  });
  it('enforces provider constraints and updates timestamps', async () => {
    await expect(
      db.query(
        "INSERT INTO amb_acm_cal_video_config (ent_id, vdc_provider) VALUES ($1, 'OTHER')",
        [A],
      ),
    ).rejects.toThrow();
    await service.update(A, USER, 'GOOGLE_MEET');
    await db.query(
      "UPDATE amb_acm_cal_video_config SET updated_at = '2000-01-01' WHERE ent_id = $1",
      [A],
    );
    const row = await db
      .getRepository(CalVideoConfigTypeormEntity)
      .findOneByOrFail({ entId: A });
    expect(row.updatedAt.getFullYear()).toBeGreaterThan(2000);
  });
  it('blocks open rooms and recent launch responses, allows closed rooms', async () => {
    await db.query(
      "INSERT INTO amb_acm_cal_boda_room VALUES ($1, $2, 'OPEN')",
      [A, EVENT],
    );
    await expect(service.update(A, USER, 'GOOGLE_MEET')).rejects.toThrow(
      'VIDEO_ACTIVE_ROOM',
    );
    await db.query("UPDATE amb_acm_cal_boda_room SET bdr_status = 'CLOSED'");
    await service.reserveLaunch(A);
    await expect(service.update(A, USER, 'GOOGLE_MEET')).rejects.toThrow(
      'VIDEO_ACTIVE_ROOM',
    );
    await db.query(
      "UPDATE amb_acm_cal_video_config SET vdc_boda_launch_until = NOW() - INTERVAL '1 second'",
    );
    await expect(service.update(A, USER, 'GOOGLE_MEET')).resolves.toMatchObject(
      { provider: 'GOOGLE_MEET' },
    );
  });
  it('serializes concurrent launch and setting change across service instances', async () => {
    const otherProcess = new VideoConfigService(db);
    let acquired!: () => void;
    const locked = new Promise<void>((resolveLock) => {
      acquired = resolveLock;
    });
    let release!: () => void;
    const canFinish = new Promise<void>((resolveWork) => {
      release = resolveWork;
    });
    const launch = service.withLock(A, async () => {
      await service.assertBoda(A);
      acquired();
      await canFinish;
      await service.reserveLaunch(A);
    });
    await locked;
    const change = otherProcess.update(A, USER, 'GOOGLE_MEET');
    const result = expect(change).rejects.toThrow('VIDEO_ACTIVE_ROOM');
    release();
    await launch;
    await result;
    expect((await service.get(A)).provider).toBe('BODASCHOOL');
    await otherProcess.onModuleDestroy();
  });
});
