import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { MapTestTypeormEntity } from '../infrastructure/typeorm/map-test.typeorm-entity';
import { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { CalEventTypeormEntity } from '../../acm-cal/infrastructure/typeorm/cal-event.typeorm-entity';
import { ResetLevelTestScheduleDto } from './dto/reset-level-test-schedule.dto';

@Injectable()
export class LevelTestScheduleResetService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  // Existing CAL services use their own pooled queries. Bound concurrent lock
  // holders so waiting requests cannot consume the whole pool before CAL runs.
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  // Include the CAL link operation in the same lock as schedule writes. The
  // legacy MAP route shares this inquiry-level lock with per-test-type routes.
  async withLock<T>(
    entId: string,
    inqId: string,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (this.active >= 2)
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    else this.active++;
    try {
      return await this.ds.transaction(async (manager) => {
        await manager.query(
          `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,
          [`csl-schedule:${entId}:${inqId}`],
        );
        return work(manager);
      });
    } finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    }
  }

  async reset(
    entId: string,
    inqId: string,
    testType: string,
    actorId: string,
    role: string,
    expected: ResetLevelTestScheduleDto,
  ) {
    if (!['STAFF', 'ADMIN', 'APP_ADMIN'].includes(role))
      throw new ForbiddenException('SCHEDULE_RESET_FORBIDDEN');
    if (
      ![
        'MAP',
        'ISEE',
        'SSAT',
        'DUOLINGO',
        'TOEFL',
        'TOEFL_JR',
        'OTHER',
      ].includes(testType)
    )
      throw new BadRequestException('INVALID_TEST_TYPE');
    return this.withLock(entId, inqId, async (manager) => {
      const inquiry = await manager.findOne(InquiryTypeormEntity, {
        where: { id: inqId, entId, deletedAt: IsNull() },
      });
      if (!inquiry) throw new NotFoundException('INQUIRY_NOT_FOUND');
      const repo = manager.getRepository(MapTestTypeormEntity);
      const mt = await repo.findOne({
        where: {
          entId,
          inqId,
          testType: testType as MapTestTypeormEntity['testType'],
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!mt) throw new NotFoundException('LEVEL_TEST_NOT_FOUND');
      if (!mt.scheduledAt && !mt.scheduledTime && !mt.calEventId)
        return { reset: true };
      const time = (s: string | null | undefined) => (s ? s.slice(0, 5) : null);
      if (
        (mt.scheduledAt ?? null) !== expected.scheduledAt ||
        time(mt.scheduledTime) !== time(expected.scheduledTime) ||
        (mt.calEventId ?? null) !== expected.calEventId
      )
        throw new ConflictException('SCHEDULE_CHANGED');
      if (mt.calEventId) {
        const event = await manager.findOne(CalEventTypeormEntity, {
          where: { id: mt.calEventId },
          lock: { mode: 'pessimistic_write' },
        });
        if (event) {
          if (
            event.entId !== entId ||
            event.category !== 'LEVEL_TEST' ||
            event.source !== 'MANUAL'
          )
            throw new ConflictException('SCHEDULE_LINK_MISMATCH');
          if (role !== 'ADMIN' && event.ownerUserId !== actorId)
            throw new ForbiddenException('NOT_OWNER');
          if (
            event.meetingProvider !== 'NONE' ||
            event.meetingUrl ||
            event.clsId
          )
            throw new ConflictException('SCHEDULE_EXTERNAL_MEETING');
          const other = await manager.query(
            `SELECT 1 FROM amb_acm_csl_map_test WHERE mpt_cal_event_id=$1 AND mpt_id<>$2 UNION ALL SELECT 1 FROM amb_acm_csl_trial_class WHERE tcl_cal_event_id=$1 LIMIT 1`,
            [event.id, mt.id],
          );
          if (other.length) throw new ConflictException('SCHEDULE_LINK_SHARED');
          if (!event.deletedAt) {
            await manager.update(
              CalEventTypeormEntity,
              { id: event.id, entId },
              {
                deletedAt: new Date(),
                deletedBy: actorId,
                deleteReason: 'CSL_LEVEL_TEST_SCHEDULE_RESET',
                updatedAt: new Date(),
              },
            );
          }
        }
      }
      await repo.update(
        { id: mt.id, entId },
        { scheduledAt: null, scheduledTime: null, calEventId: null },
      );
      return { reset: true };
    });
  }
}
