import { AsyncLocalStorage } from 'node:async_hooks';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AuditLogTypeormEntity } from '../../acm-audit/infrastructure/typeorm/audit-log.typeorm-entity';
import {
  CalVideoConfigTypeormEntity,
  VideoProvider,
} from '../infrastructure/typeorm/video-config.typeorm-entity';

@Injectable()
export class VideoConfigService implements OnModuleDestroy {
  private lockDb?: Promise<DataSource>;
  private readonly locks = new AsyncLocalStorage<ReadonlySet<string>>();
  constructor(@InjectDataSource(ACM_DS) private readonly db: DataSource) {}

  // Locks use a small separate pool: queued launch requests must not consume the
  // application pool while a lock holder needs it to finish a calendar write.
  protected lockDatabase(): Promise<DataSource> {
    const options = this.db.options;
    if (options.type !== 'postgres')
      throw new Error('Video settings require PostgreSQL');
    return (this.lockDb ??= new DataSource({
      ...options,
      name: 'acm-video-locks',
      entities: [CalVideoConfigTypeormEntity, AuditLogTypeormEntity],
      subscribers: [],
      migrations: [],
      migrationsRun: false,
      synchronize: false,
      dropSchema: false,
      poolSize: 2,
      extra: { ...options.extra, max: 2 },
    })
      .initialize()
      .catch((error: unknown) => {
        this.lockDb = undefined;
        throw error;
      }));
  }

  async onModuleDestroy() {
    const db = await this.lockDb;
    if (db?.isInitialized) await db.destroy();
  }

  async get(entId: string) {
    const row = await this.db
      .getRepository(CalVideoConfigTypeormEntity)
      .findOneBy({ entId });
    const provider = row?.provider ?? 'BODASCHOOL';
    return { provider, bodaEnabled: provider === 'BODASCHOOL' };
  }

  // Cross-process, reentrant tenant lock shared by setting changes and class/launch requests.
  async withLock<T>(entId: string, work: () => Promise<T>): Promise<T> {
    if (this.locks.getStore()?.has(entId)) return work();
    return (await this.lockDatabase()).transaction(async (manager) => {
      await this.lock(manager, entId);
      return this.locks.run(
        new Set([...(this.locks.getStore() ?? []), entId]),
        work,
      );
    });
  }

  private async lock(manager: EntityManager, entId: string) {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`cal-video:${entId}`],
    );
  }

  async assertBoda(entId: string) {
    if (!(await this.get(entId)).bodaEnabled)
      throw new ForbiddenException('VIDEO_PROVIDER_DISABLED');
  }

  async assertNoActiveRooms(entId: string, evtId?: string) {
    const rows: { active: boolean }[] = await this.db.query(
      `SELECT EXISTS (SELECT 1 FROM amb_acm_cal_boda_room
       WHERE ent_id = $1 AND bdr_status IN ('OPEN', 'STARTED', 'PAUSED', 'ENDED')
       AND ($2::uuid IS NULL OR evt_id = $2)) OR EXISTS (
         SELECT 1 FROM amb_acm_cal_video_config WHERE ent_id = $1 AND vdc_boda_launch_until > NOW()
       ) AS active`,
      [entId, evtId ?? null],
    );
    if (rows[0]?.active) throw new ConflictException('VIDEO_ACTIVE_ROOM');
  }

  // A launch response can be used before the vendor's OPEN webhook arrives.
  // Reserve a short handoff window so settings cannot switch in that gap.
  async reserveLaunch(entId: string) {
    await this.db.query(
      `INSERT INTO amb_acm_cal_video_config (ent_id, vdc_boda_launch_until)
      VALUES ($1, NOW() + INTERVAL '2 minutes') ON CONFLICT (ent_id)
      DO UPDATE SET vdc_boda_launch_until = EXCLUDED.vdc_boda_launch_until`,
      [entId],
    );
  }

  async update(entId: string, actorId: string, provider: VideoProvider) {
    return (await this.lockDatabase()).transaction(async (manager) => {
      await this.lock(manager, entId);
      const repo = manager.getRepository(CalVideoConfigTypeormEntity);
      const row = await repo.findOneBy({ entId });
      const previous = row?.provider ?? 'BODASCHOOL';
      if (previous !== provider) await this.assertNoActiveRooms(entId);
      await repo.upsert({ entId, provider }, ['entId']);
      if (previous !== provider) {
        await manager.getRepository(AuditLogTypeormEntity).save({
          entId,
          userId: actorId,
          action: 'UPDATE',
          entityType: 'CAL_VIDEO_CONFIG',
          entityId: entId,
          fieldName: 'provider',
          oldValue: previous,
          newValue: provider,
        });
      }
      return { provider, bodaEnabled: provider === 'BODASCHOOL' };
    });
  }
}
