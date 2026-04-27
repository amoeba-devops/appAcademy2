import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ClassStudentTypeormEntity } from '../infrastructure/typeorm/class-student.typeorm-entity';
import { ClassTypeormEntity } from '../infrastructure/typeorm/class.typeorm-entity';
import { RecurrenceTypeormEntity } from '../infrastructure/typeorm/recurrence.typeorm-entity';
import { VideoConfigTypeormEntity } from '../infrastructure/typeorm/video-config.typeorm-entity';
import type {
  ChangeClassStatusDto,
  CreateClassDto,
  ListClassesQueryDto,
  UpdateClassDto,
} from './dto/class.dto';

@Injectable()
export class ClassService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    @InjectRepository(ClassTypeormEntity, ACM_DS)
    private readonly clsRepo: Repository<ClassTypeormEntity>,
    @InjectRepository(ClassStudentTypeormEntity, ACM_DS)
    private readonly cstRepo: Repository<ClassStudentTypeormEntity>,
    @InjectRepository(RecurrenceTypeormEntity, ACM_DS)
    private readonly recRepo: Repository<RecurrenceTypeormEntity>,
    @InjectRepository(VideoConfigTypeormEntity, ACM_DS)
    private readonly vcfRepo: Repository<VideoConfigTypeormEntity>,
    private readonly events: EventEmitter2,
  ) {}

  /** Generate next CLS-YYYY-NNN code per ent. */
  private async nextCode(entId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CLS-${year}-`;
    const last = await this.clsRepo
      .createQueryBuilder('c')
      .where('c.entId = :e AND c.code LIKE :p', { e: entId, p: `${prefix}%` })
      .orderBy('c.code', 'DESC')
      .getOne();
    const n = last ? parseInt(last.code.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(n).padStart(3, '0')}`;
  }

  async create(entId: string, dto: CreateClassDto, actorId?: string) {
    if (!dto.students.some((s) => (s.capacityRole ?? 'PRIMARY') === 'PRIMARY')) {
      throw new BadRequestException('VAL_NO_PRIMARY_STUDENT');
    }
    if (!dto.recurrences.length) {
      throw new BadRequestException('At least one recurrence is required');
    }

    const code = await this.nextCode(entId);
    const now = new Date();
    const isGroup = dto.students.length > 1;

    const result = await this.ds.transaction(async (em) => {
      const cls = em.getRepository(ClassTypeormEntity).create({
        id: randomUUID(),
        entId,
        code,
        inqId: dto.inqId ?? null,
        startedFrom: dto.startedFrom ?? 'DIRECT_ENROLLMENT',
        subjectType: dto.subjectType,
        subjectLabel: dto.subjectLabel ?? null,
        refGuidelineId: dto.refGuidelineId ?? null,
        teacherUserId: dto.teacherUserId,
        isDemo: dto.isDemo ?? false,
        isGroup,
        isInPersonDefault: dto.isInPersonDefault ?? false,
        status: 'PROPOSED',
        startedAt: dto.startedAt,
        endedAt: dto.endedAt ?? null,
        completedAt: null,
        visibility: 'ENTITY',
        remark: dto.remark ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      const savedCls = await em.getRepository(ClassTypeormEntity).save(cls);

      await em.getRepository(ClassStudentTypeormEntity).save(
        dto.students.map((s) =>
          em.getRepository(ClassStudentTypeormEntity).create({
            id: randomUUID(),
            entId,
            clsId: savedCls.id,
            studentUserId: s.studentUserId,
            hourlyRate: String(s.hourlyRate),
            capacityRole: s.capacityRole ?? 'PRIMARY',
            enrolledAt: dto.startedAt,
            leftAt: null,
            inqId: s.inqId ?? null,
            createdAt: now,
            updatedAt: now,
          }),
        ),
      );

      await em.getRepository(RecurrenceTypeormEntity).save(
        dto.recurrences.map((r) =>
          em.getRepository(RecurrenceTypeormEntity).create({
            id: randomUUID(),
            entId,
            clsId: savedCls.id,
            dayOfWeek: r.dayOfWeek,
            startTime: r.startTime.length === 5 ? `${r.startTime}:00` : r.startTime,
            durationMin: r.durationMin,
            defaultMode: r.defaultMode ?? 'ONLINE',
            effectiveFrom: r.effectiveFrom ?? dto.startedAt,
            effectiveTo: null,
            exceptions: r.exceptions ?? null,
            createdAt: now,
            updatedAt: now,
          }),
        ),
      );

      if (dto.videoProvider || dto.videoPersistentLink) {
        await em.getRepository(VideoConfigTypeormEntity).save(
          em.getRepository(VideoConfigTypeormEntity).create({
            id: randomUUID(),
            entId,
            clsId: savedCls.id,
            provider: dto.videoProvider ?? 'GOOGLE_MEET',
            persistentLink: dto.videoPersistentLink ?? null,
            bodaschoolRoomId: null,
            gmeetEventId: null,
            changedAt: now,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }

      return savedCls;
    });

    this.events.emit('acm.cls.created', {
      entId,
      occurredAt: now.toISOString(),
      actorId,
      clsId: result.id,
      teacherUserId: dto.teacherUserId,
    });
    return result;
  }

  async list(entId: string, q: ListClassesQueryDto) {
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const offset = Number(q.offset ?? 0);
    const qb = this.clsRepo
      .createQueryBuilder('c')
      .where('c.entId = :e AND c.deletedAt IS NULL', { e: entId });
    if (q.status) qb.andWhere('c.status = :s', { s: q.status });
    if (q.subjectType) qb.andWhere('c.subjectType = :st', { st: q.subjectType });
    if (q.teacherUserId) qb.andWhere('c.teacherUserId = :t', { t: q.teacherUserId });
    if (q.studentUserId) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM amb_acm_cls_class_students cst
                  WHERE cst.cls_id = c.cls_id AND cst.cst_student_user_id = :stu)`,
        { stu: q.studentUserId },
      );
    }
    qb.orderBy('c.startedAt', 'DESC').take(limit).skip(offset);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(entId: string, id: string) {
    const c = await this.clsRepo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Class not found');
    const [students, recurrences, videoConfig] = await Promise.all([
      this.cstRepo.find({ where: { entId, clsId: id } }),
      this.recRepo.find({ where: { entId, clsId: id } }),
      this.vcfRepo.findOne({ where: { entId, clsId: id } }),
    ]);
    return { ...c, students, recurrences, videoConfig };
  }

  async update(entId: string, id: string, dto: UpdateClassDto) {
    const c = await this.clsRepo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Class not found');
    if (dto.subjectType !== undefined) c.subjectType = dto.subjectType;
    if (dto.subjectLabel !== undefined) c.subjectLabel = dto.subjectLabel ?? null;
    if (dto.teacherUserId !== undefined) c.teacherUserId = dto.teacherUserId;
    if (dto.isDemo !== undefined) c.isDemo = dto.isDemo;
    if (dto.isInPersonDefault !== undefined) c.isInPersonDefault = dto.isInPersonDefault;
    if (dto.endedAt !== undefined) c.endedAt = dto.endedAt ?? null;
    if (dto.remark !== undefined) c.remark = dto.remark ?? null;
    if (dto.refGuidelineId !== undefined) c.refGuidelineId = dto.refGuidelineId ?? null;
    c.updatedAt = new Date();
    return this.clsRepo.save(c);
  }

  async changeStatus(entId: string, id: string, dto: ChangeClassStatusDto, actorId?: string) {
    const c = await this.clsRepo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Class not found');
    c.status = dto.status;
    if (dto.status === 'COMPLETED' && !c.completedAt) {
      c.completedAt = new Date().toISOString().slice(0, 10);
    }
    c.updatedAt = new Date();
    const saved = await this.clsRepo.save(c);
    this.events.emit('acm.cls.status.changed', {
      entId,
      occurredAt: new Date().toISOString(),
      actorId,
      clsId: id,
      status: dto.status,
    });
    return saved;
  }
}
