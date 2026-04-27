import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Between, DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ClassStudentTypeormEntity } from '../infrastructure/typeorm/class-student.typeorm-entity';
import { ClassTypeormEntity } from '../infrastructure/typeorm/class.typeorm-entity';
import { RecurrenceTypeormEntity, type RecDayOfWeek } from '../infrastructure/typeorm/recurrence.typeorm-entity';
import { SessionTypeormEntity, type SesStatus } from '../infrastructure/typeorm/session.typeorm-entity';
import type {
  CancelSessionDto,
  CreateSessionDto,
  HoldSessionDto,
  ListSessionsQueryDto,
  RescheduleSessionDto,
} from './dto/session.dto';

const DOW_INDEX: Record<RecDayOfWeek, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

interface ConflictDetail {
  scope: 'TEACHER' | 'STUDENT';
  conflictingSessionId: string;
  clsId: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    @InjectRepository(SessionTypeormEntity, ACM_DS)
    private readonly sesRepo: Repository<SessionTypeormEntity>,
    @InjectRepository(ClassTypeormEntity, ACM_DS)
    private readonly clsRepo: Repository<ClassTypeormEntity>,
    @InjectRepository(RecurrenceTypeormEntity, ACM_DS)
    private readonly recRepo: Repository<RecurrenceTypeormEntity>,
    @InjectRepository(ClassStudentTypeormEntity, ACM_DS)
    private readonly cstRepo: Repository<ClassStudentTypeormEntity>,
    private readonly events: EventEmitter2,
  ) {}

  // ──────────────────────────────────────────────────────────────────
  // Conflict detection — BR-CLS-011 / BR-CLS-012
  // ──────────────────────────────────────────────────────────────────
  async detectConflicts(
    entId: string,
    clsId: string,
    scheduledAt: Date,
    durationMin: number,
    excludeSesId?: string,
  ): Promise<ConflictDetail[]> {
    const start = scheduledAt;
    const end = new Date(scheduledAt.getTime() + durationMin * 60_000);

    const cls = await this.clsRepo.findOne({ where: { id: clsId, entId } });
    if (!cls) throw new NotFoundException('Class not found');

    const teacherUserId = cls.teacherUserId;
    const studentIds = (
      await this.cstRepo.find({ where: { entId, clsId } })
    )
      .filter((s) => !s.leftAt)
      .map((s) => s.studentUserId);

    const conflicts: ConflictDetail[] = [];

    // Teacher conflict (BR-CLS-011)
    const teacherRows = await this.ds.query<
      { ses_id: string; cls_id: string }[]
    >(
      `SELECT s.ses_id, s.cls_id FROM amb_acm_cls_sessions s
        JOIN amb_acm_cls_classes c ON c.cls_id = s.cls_id AND c.cls_deleted_at IS NULL
        WHERE s.ent_id = $1
          AND c.cls_teacher_user_id = $2
          AND s.ses_status IN ('SCHEDULED','RESCHEDULED','HELD','MAKEUP_REPLACEMENT')
          AND s.ses_deleted_at IS NULL
          AND ($3::uuid IS NULL OR s.ses_id <> $3)
          AND tstzrange(s.ses_scheduled_at,
                        s.ses_scheduled_at + (s.ses_duration_min || ' minutes')::interval,
                        '[)')
              && tstzrange($4::timestamptz, $5::timestamptz, '[)')`,
      [entId, teacherUserId, excludeSesId ?? null, start.toISOString(), end.toISOString()],
    );
    for (const r of teacherRows) {
      conflicts.push({ scope: 'TEACHER', conflictingSessionId: r.ses_id, clsId: r.cls_id });
    }

    // Student conflict (BR-CLS-012)
    if (studentIds.length > 0) {
      const studentRows = await this.ds.query<
        { ses_id: string; cls_id: string }[]
      >(
        `SELECT DISTINCT s.ses_id, s.cls_id
           FROM amb_acm_cls_sessions s
           JOIN amb_acm_cls_class_students cst ON cst.cls_id = s.cls_id
                AND cst.cst_left_at IS NULL
                AND cst.cst_student_user_id = ANY($2::uuid[])
          WHERE s.ent_id = $1
            AND s.ses_status IN ('SCHEDULED','RESCHEDULED','HELD','MAKEUP_REPLACEMENT')
            AND s.ses_deleted_at IS NULL
            AND ($3::uuid IS NULL OR s.ses_id <> $3)
            AND tstzrange(s.ses_scheduled_at,
                          s.ses_scheduled_at + (s.ses_duration_min || ' minutes')::interval,
                          '[)')
                && tstzrange($4::timestamptz, $5::timestamptz, '[)')`,
        [entId, studentIds, excludeSesId ?? null, start.toISOString(), end.toISOString()],
      );
      for (const r of studentRows) {
        conflicts.push({ scope: 'STUDENT', conflictingSessionId: r.ses_id, clsId: r.cls_id });
      }
    }

    return conflicts;
  }

  // ──────────────────────────────────────────────────────────────────
  // Session generation from recurrence (used by Cron + on class create)
  // ──────────────────────────────────────────────────────────────────
  async generateForClass(
    entId: string,
    clsId: string,
    horizonDays = 35,
  ): Promise<{ generated: number; skipped: number }> {
    const cls = await this.clsRepo.findOne({ where: { id: clsId, entId, deletedAt: IsNull() } });
    if (!cls) throw new NotFoundException('Class not found');
    if (cls.status === 'CANCELLED' || cls.status === 'COMPLETED') return { generated: 0, skipped: 0 };

    const recs = await this.recRepo.find({ where: { entId, clsId } });
    if (!recs.length) return { generated: 0, skipped: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + horizonDays);

    const startBound = new Date(cls.startedAt);
    const endBound = cls.endedAt ? new Date(cls.endedAt) : null;

    const existing = await this.sesRepo.find({
      where: { entId, clsId, deletedAt: IsNull() },
    });
    const existingKeys = new Set(
      existing.map((s) => `${s.scheduledAt.toISOString().slice(0, 16)}`),
    );
    const maxSeq = existing.reduce((m, s) => Math.max(m, s.seqNo), 0);

    let generated = 0;
    let skipped = 0;
    let nextSeq = maxSeq + 1;
    const now = new Date();

    for (const rec of recs) {
      const dow = DOW_INDEX[rec.dayOfWeek];
      const exceptions = new Set(rec.exceptions ?? []);
      const effFrom = new Date(rec.effectiveFrom);
      const effTo = rec.effectiveTo ? new Date(rec.effectiveTo) : null;
      const [hh, mm] = rec.startTime.split(':').map((x) => parseInt(x, 10));

      for (const cursor = new Date(today); cursor < horizon; cursor.setDate(cursor.getDate() + 1)) {
        if (cursor.getDay() !== dow) continue;
        if (cursor < startBound || cursor < effFrom) continue;
        if (endBound && cursor > endBound) continue;
        if (effTo && cursor > effTo) continue;
        const isoDate = cursor.toISOString().slice(0, 10);
        if (exceptions.has(isoDate)) continue;

        const scheduled = new Date(cursor);
        scheduled.setHours(hh, mm ?? 0, 0, 0);
        const key = scheduled.toISOString().slice(0, 16);
        if (existingKeys.has(key)) {
          skipped += 1;
          continue;
        }

        await this.sesRepo.insert({
          id: randomUUID(),
          entId,
          clsId,
          seqNo: nextSeq,
          scheduledAt: scheduled,
          durationMin: rec.durationMin,
          heldAt: null,
          actualMinutes: null,
          status: 'SCHEDULED',
          mode: rec.defaultMode === 'IN_PERSON' ? 'IN_PERSON'
            : rec.defaultMode === 'TWO_PERSON_IN_PERSON' ? 'TWO_PERSON_IN_PERSON'
            : 'ONLINE',
          cancelReason: null,
          cancelNote: null,
          cancelledBy: null,
          cancelledAt: null,
          cancelDisposition: null,
          isMakeup: false,
          replacesSesId: null,
          videoProvider: 'NONE',
          videoUrl: null,
          videoLinkSentAt: null,
          gcalEventId: null,
          gcalPushedAt: null,
          gcalPushStatus: 'NOT_REQUESTED',
          modificationCount: 0,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
        existingKeys.add(key);
        nextSeq += 1;
        generated += 1;
      }
    }
    return { generated, skipped };
  }

  async generateAll(entId?: string, horizonDays = 35) {
    const qb = this.clsRepo
      .createQueryBuilder('c')
      .where('c.deletedAt IS NULL AND c.status IN (:...st)', {
        st: ['PROPOSED', 'ACTIVE', 'PAUSED'],
      });
    if (entId) qb.andWhere('c.entId = :e', { e: entId });
    const classes = await qb.getMany();
    let total = 0;
    for (const c of classes) {
      const r = await this.generateForClass(c.entId, c.id, horizonDays);
      total += r.generated;
    }
    return { classes: classes.length, generated: total };
  }

  // ──────────────────────────────────────────────────────────────────
  // CRUD-ish session ops
  // ──────────────────────────────────────────────────────────────────
  async createOne(entId: string, dto: CreateSessionDto, actorId?: string) {
    const cls = await this.clsRepo.findOne({ where: { id: dto.clsId, entId, deletedAt: IsNull() } });
    if (!cls) throw new NotFoundException('Class not found');
    const scheduled = new Date(dto.scheduledAt);
    const conflicts = await this.detectConflicts(entId, dto.clsId, scheduled, dto.durationMin);
    if (conflicts.length) throw new ConflictException({ code: 'CLS_SESSION_CONFLICT', conflicts });

    const max = await this.sesRepo
      .createQueryBuilder('s')
      .where('s.entId = :e AND s.clsId = :c', { e: entId, c: dto.clsId })
      .select('MAX(s.seqNo)', 'm')
      .getRawOne<{ m: number | null }>();
    const seqNo = (max?.m ?? 0) + 1;
    const now = new Date();
    const inserted = await this.sesRepo.save(
      this.sesRepo.create({
        id: randomUUID(),
        entId,
        clsId: dto.clsId,
        seqNo,
        scheduledAt: scheduled,
        durationMin: dto.durationMin,
        status: 'SCHEDULED',
        mode: dto.mode ?? (cls.isInPersonDefault ? 'IN_PERSON' : 'ONLINE'),
        isMakeup: false,
        videoProvider: 'NONE',
        gcalPushStatus: 'NOT_REQUESTED',
        modificationCount: 0,
        createdAt: now,
        updatedAt: now,
      }),
    );
    this.events.emit('acm.cls.session.created', {
      entId, occurredAt: now.toISOString(), actorId, sesId: inserted.id, clsId: dto.clsId,
    });
    return inserted;
  }

  async list(entId: string, q: ListSessionsQueryDto) {
    const qb = this.sesRepo
      .createQueryBuilder('s')
      .where('s.entId = :e AND s.deletedAt IS NULL', { e: entId });
    if (q.clsId) qb.andWhere('s.clsId = :c', { c: q.clsId });
    if (q.status) qb.andWhere('s.status = :st', { st: q.status });
    if (q.from) qb.andWhere('s.scheduledAt >= :f', { f: q.from });
    if (q.to) qb.andWhere('s.scheduledAt < :t', { t: q.to });
    if (q.teacherUserId) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM amb_acm_cls_classes c
                  WHERE c.cls_id = s.cls_id AND c.cls_teacher_user_id = :tu)`,
        { tu: q.teacherUserId },
      );
    }
    qb.orderBy('s.scheduledAt', 'ASC').take(500);
    return qb.getMany();
  }

  async findOne(entId: string, id: string) {
    const s = await this.sesRepo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!s) throw new NotFoundException('Session not found');
    return s;
  }

  async reschedule(entId: string, id: string, dto: RescheduleSessionDto, actorId?: string) {
    const s = await this.findOne(entId, id);
    if (s.status === 'HELD' || s.status === 'CANCELLED') {
      throw new BadRequestException('VAL_SES_STATUS_TRANSITION');
    }
    const scheduled = new Date(dto.scheduledAt);
    const dur = dto.durationMin ?? s.durationMin;
    const conflicts = await this.detectConflicts(entId, s.clsId, scheduled, dur, id);
    if (conflicts.length) throw new ConflictException({ code: 'CLS_SESSION_CONFLICT', conflicts });

    s.scheduledAt = scheduled;
    if (dto.durationMin !== undefined) s.durationMin = dto.durationMin;
    if (dto.mode !== undefined) s.mode = dto.mode;
    s.status = 'RESCHEDULED';
    s.modificationCount += 1;
    s.gcalPushStatus = 'OUTDATED';
    s.updatedAt = new Date();
    const saved = await this.sesRepo.save(s);
    this.events.emit('acm.cls.session.rescheduled', {
      entId, occurredAt: new Date().toISOString(), actorId, sesId: id,
    });
    return saved;
  }

  async cancel(entId: string, id: string, dto: CancelSessionDto, actorId?: string) {
    const s = await this.findOne(entId, id);
    if (s.status === 'CANCELLED' || s.status === 'HELD') {
      throw new BadRequestException('VAL_SES_STATUS_TRANSITION');
    }
    if (dto.cancelReason === 'OTHER' && !dto.cancelNote) {
      throw new BadRequestException('VAL_OTHER_NOTE_REQUIRED');
    }
    const now = new Date();
    s.status = 'CANCELLED';
    s.cancelReason = dto.cancelReason;
    s.cancelNote = dto.cancelNote ?? null;
    s.cancelDisposition = dto.cancelDisposition ?? 'NO_MAKEUP';
    s.cancelledAt = now;
    s.cancelledBy = actorId ?? null;
    s.modificationCount += 1;
    s.gcalPushStatus = 'OUTDATED';
    s.updatedAt = now;
    const saved = await this.sesRepo.save(s);
    this.events.emit('acm.cls.session.cancelled', {
      entId, occurredAt: now.toISOString(), actorId, sesId: id,
      cancelReason: dto.cancelReason, disposition: s.cancelDisposition,
    });
    return saved;
  }

  /** Mark session HELD (after attendance is recorded). */
  async markHeld(entId: string, id: string, dto: HoldSessionDto, actorId?: string) {
    const s = await this.findOne(entId, id);
    if (s.status === 'CANCELLED') throw new BadRequestException('VAL_SES_STATUS_TRANSITION');
    const now = new Date();
    s.heldAt = dto.heldAt ? new Date(dto.heldAt) : now;
    s.actualMinutes = dto.actualMinutes ?? s.durationMin;
    s.status = 'HELD';
    s.updatedAt = now;
    const saved = await this.sesRepo.save(s);
    this.events.emit('acm.cls.session.held', {
      entId, occurredAt: now.toISOString(), actorId, sesId: id, clsId: s.clsId,
    });
    return saved;
  }

  // ──────────────────────────────────────────────────────────────────
  // Helpers consumed by SettlementService / DSH
  // ──────────────────────────────────────────────────────────────────
  async findHeldInRange(entId: string, from: string, to: string) {
    return this.sesRepo.find({
      where: {
        entId,
        deletedAt: IsNull(),
        status: 'HELD',
        scheduledAt: Between(new Date(from), new Date(to)),
      },
    });
  }
}
