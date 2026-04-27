import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { AMA_CLIENT_SERVICE } from './interfaces/ama-client.interface';
import type { IAmaClientService } from './interfaces/ama-client.interface';
import { AmaClientDto } from './dto/ama-client.dto';

/**
 * Synchronizes TAC Teacher cached profiles with AMA Client master.
 *
 * Behavior:
 *  - syncOne: fetch by clientId, update tch_cached_profile / tch_last_synced_at.
 *             AMA 404 → mark teacher as INACTIVE (soft).
 *  - syncAll: cron-driven background job over all ACTIVE teachers.
 */
@Injectable()
export class TeacherSyncService {
  private readonly logger = new Logger(TeacherSyncService.name);
  private readonly cronEnabled: boolean;

  constructor(
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @Inject(AMA_CLIENT_SERVICE)
    private readonly ama: IAmaClientService,
    config: ConfigService,
  ) {
    this.cronEnabled =
      String(config.get('AMA_SYNC_CRON_ENABLED', 'true')).toLowerCase() !== 'false';
  }

  /**
   * Sync a single teacher with AMA. Returns the updated entity.
   *
   * If AMA returns 404, teacher is marked INACTIVE.
   */
  async syncOne(teacherId: number): Promise<TeacherEntity> {
    const teacher = await this.teacherRepo.findOneOrFail({
      where: { tchId: teacherId },
    });
    return this.syncEntity(teacher);
  }

  /**
   * Sync every ACTIVE teacher across all academies.
   * Continues on individual failures.
   */
  async syncAll(): Promise<{ ok: number; deactivated: number; failed: number }> {
    const teachers = await this.teacherRepo.find({ where: { tchStatus: 'ACTIVE' } });
    let ok = 0;
    let deactivated = 0;
    let failed = 0;
    for (const t of teachers) {
      try {
        const updated = await this.syncEntity(t);
        if (updated.tchStatus === 'INACTIVE') deactivated += 1;
        else ok += 1;
      } catch (err) {
        failed += 1;
        this.logger.error(
          `syncAll: teacher #${t.tchId} (${t.tchAmaClientId}) failed`,
          err as Error,
        );
      }
    }
    this.logger.log(`syncAll done — ok=${ok} deactivated=${deactivated} failed=${failed}`);
    return { ok, deactivated, failed };
  }

  // Cron schedule env var is read at module load via @Cron (string literal).
  // Keeping fixed schedule "*/15 * * * *" — tweakable in code; cronEnabled gates execution.
  @Cron('*/15 * * * *', { name: 'ama-teacher-sync' })
  async cron(): Promise<void> {
    if (!this.cronEnabled) return;
    this.logger.log('Cron tick — running AMA teacher sync');
    try {
      await this.syncAll();
    } catch (err) {
      this.logger.error('Cron syncAll failed', err as Error);
    }
  }

  // ---------------------------------------------------------------------------

  private async syncEntity(teacher: TeacherEntity): Promise<TeacherEntity> {
    const client = await this.ama.getClient(teacher.tchAmaClientId);
    if (!client) {
      // 404 → soft deactivate
      teacher.tchStatus = 'INACTIVE';
      teacher.tchLastSyncedAt = new Date();
      this.logger.warn(
        `AMA Client '${teacher.tchAmaClientId}' not found — teacher #${teacher.tchId} → INACTIVE`,
      );
      return this.teacherRepo.save(teacher);
    }
    teacher.tchCachedProfile = this.toCachedProfile(client);
    teacher.tchLastSyncedAt = new Date();
    // If AMA reports DELETED/INACTIVE, mirror locally
    if (client.status === 'DELETED' || client.status === 'INACTIVE') {
      teacher.tchStatus = 'INACTIVE';
    }
    return this.teacherRepo.save(teacher);
  }

  toCachedProfile(client: AmaClientDto): Record<string, unknown> {
    return {
      name: client.name,
      phone: client.phone,
      email: client.email,
      employmentType: client.employmentType ?? null,
      profileImageUrl: client.profileImageUrl ?? null,
      amaUpdatedAt: client.updatedAt,
    };
  }
}
