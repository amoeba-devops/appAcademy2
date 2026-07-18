import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { CourseTypeormEntity } from '../../acm-csl/infrastructure/typeorm/course.typeorm-entity';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
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
    @InjectRepository(AcmUserTypeormEntity, ACM_DS)
    private readonly userRepo: Repository<AcmUserTypeormEntity>,
    @InjectRepository(CourseTypeormEntity, ACM_DS)
    private readonly courseRepo: Repository<CourseTypeormEntity>,
    @InjectRepository(StudentTypeormEntity, ACM_DS)
    private readonly stdRepo: Repository<StudentTypeormEntity>,
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
    if (
      !dto.students.some((s) => (s.capacityRole ?? 'PRIMARY') === 'PRIMARY')
    ) {
      throw new BadRequestException('VAL_NO_PRIMARY_STUDENT');
    }
    // PLN-260719 D — 날짜 지정(개별 세션) 생성이 기본이 되면서 반복 일정은 옵션.
    const recurrences = dto.recurrences ?? [];
    // PLN-260719 D — 강사는 /admin/tch 마스터(tch_id) 기준. 콘솔계정(usr)은
    // 연결돼 있으면 dual-write (legacy teacherUserId 입력도 tch 로 역해석).
    const teacher = await this.resolveTeacherRef(
      entId,
      dto.teacherTchId,
      dto.teacherUserId,
    );
    if (dto.courseId) {
      await this.assertCourseExists(entId, dto.courseId);
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
        courseId: dto.courseId ?? null,
        refGuidelineId: dto.refGuidelineId ?? null,
        teacherUserId: teacher.userId,
        teacherTchId: teacher.tchId,
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
            // PLN-260719 D — 시급 옵션화 (미입력 시 NULL, 정산은 0 처리).
            hourlyRate: s.hourlyRate != null ? String(s.hourlyRate) : null,
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
        recurrences.map((r) =>
          em.getRepository(RecurrenceTypeormEntity).create({
            id: randomUUID(),
            entId,
            clsId: savedCls.id,
            dayOfWeek: r.dayOfWeek,
            startTime:
              r.startTime.length === 5 ? `${r.startTime}:00` : r.startTime,
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
      teacherUserId: teacher.userId,
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
    if (q.subjectType)
      qb.andWhere('c.subjectType = :st', { st: q.subjectType });
    if (q.teacherUserId)
      qb.andWhere('c.teacherUserId = :t', { t: q.teacherUserId });
    if (q.studentUserId) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM amb_acm_cls_class_students cst
                  WHERE cst.cls_id = c.cls_id AND cst.cst_student_user_id = :stu)`,
        { stu: q.studentUserId },
      );
    }
    qb.orderBy('c.startedAt', 'DESC').take(limit).skip(offset);
    const [items, total] = await qb.getManyAndCount();
    return {
      items: await this.hydrateSummaries(entId, items),
      total,
    };
  }

  async findOne(entId: string, id: string) {
    const c = await this.clsRepo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!c) throw new NotFoundException('Class not found');
    const [students, recurrences, videoConfig, teacherMap] = await Promise.all([
      this.cstRepo.find({ where: { entId, clsId: id } }),
      this.recRepo.find({ where: { entId, clsId: id } }),
      this.vcfRepo.findOne({ where: { entId, clsId: id } }),
      this.teacherNamesForClasses(entId, [c]),
    ]);
    const studentMap = await this.lookupStudentNames(
      entId,
      students.map((row) => row.studentUserId),
    );
    const primaryStudent =
      students.find((row) => row.capacityRole === 'PRIMARY') ??
      students[0] ??
      null;
    const defaultMode =
      recurrences[0]?.defaultMode ??
      (c.isInPersonDefault ? 'IN_PERSON' : 'ONLINE');
    return {
      ...c,
      teacherName: teacherMap.get(c.id) ?? null,
      defaultMode,
      hourlyRateKrw: primaryStudent?.hourlyRate ?? null,
      students: students.map((row) => ({
        id: row.id,
        studentUserId: row.studentUserId,
        studentName: studentMap.get(row.studentUserId) ?? null,
        joinedAt: row.enrolledAt,
        leftAt: row.leftAt ?? null,
        capacityRole: row.capacityRole === 'PRIMARY' ? 'PRIMARY' : 'SECONDARY',
      })),
      recurrences,
      videoConfig: videoConfig
        ? {
            provider: videoConfig.provider,
            persistentLink: videoConfig.persistentLink ?? null,
          }
        : null,
    };
  }

  async update(entId: string, id: string, dto: UpdateClassDto) {
    const c = await this.clsRepo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!c) throw new NotFoundException('Class not found');
    if (dto.subjectType !== undefined) c.subjectType = dto.subjectType;
    if (dto.subjectLabel !== undefined)
      c.subjectLabel = dto.subjectLabel ?? null;
    if (dto.courseId !== undefined) {
      // `null` clears the link; only validate when an actual id is supplied.
      if (dto.courseId) await this.assertCourseExists(entId, dto.courseId);
      c.courseId = dto.courseId ?? null;
    }
    if (dto.teacherUserId !== undefined) c.teacherUserId = dto.teacherUserId;
    if (dto.isDemo !== undefined) c.isDemo = dto.isDemo;
    if (dto.isInPersonDefault !== undefined)
      c.isInPersonDefault = dto.isInPersonDefault;
    if (dto.endedAt !== undefined) c.endedAt = dto.endedAt ?? null;
    if (dto.remark !== undefined) c.remark = dto.remark ?? null;
    if (dto.refGuidelineId !== undefined)
      c.refGuidelineId = dto.refGuidelineId ?? null;
    c.updatedAt = new Date();
    return this.clsRepo.save(c);
  }

  async changeStatus(
    entId: string,
    id: string,
    dto: ChangeClassStatusDto,
    actorId?: string,
  ) {
    const c = await this.clsRepo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
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

  private async hydrateSummaries(
    entId: string,
    classes: ClassTypeormEntity[],
  ): Promise<
    Array<
      ClassTypeormEntity & {
        teacherName: string | null;
        defaultMode: 'IN_PERSON' | 'ONLINE' | 'TWO_PERSON_IN_PERSON';
        hourlyRateKrw: string | null;
      }
    >
  > {
    if (classes.length === 0) return [];
    const classIds = classes.map((row) => row.id);
    const [teacherMap, recurrences, students] = await Promise.all([
      this.teacherNamesForClasses(entId, classes),
      this.recRepo.find({ where: { entId, clsId: In(classIds) } }),
      this.cstRepo.find({ where: { entId, clsId: In(classIds) } }),
    ]);

    const defaultModeByClass = new Map<
      string,
      'IN_PERSON' | 'ONLINE' | 'TWO_PERSON_IN_PERSON'
    >();
    for (const recurrence of recurrences) {
      if (!defaultModeByClass.has(recurrence.clsId)) {
        defaultModeByClass.set(recurrence.clsId, recurrence.defaultMode);
      }
    }

    const primaryRateByClass = new Map<string, string>();
    for (const row of students) {
      if (row.hourlyRate == null) continue;
      if (
        row.capacityRole === 'PRIMARY' &&
        !primaryRateByClass.has(row.clsId)
      ) {
        primaryRateByClass.set(row.clsId, row.hourlyRate);
      }
      if (!primaryRateByClass.has(row.clsId)) {
        primaryRateByClass.set(row.clsId, row.hourlyRate);
      }
    }

    return classes.map((row) => ({
      ...row,
      teacherName: teacherMap.get(row.id) ?? null,
      defaultMode:
        defaultModeByClass.get(row.id) ??
        (row.isInPersonDefault ? 'IN_PERSON' : 'ONLINE'),
      hourlyRateKrw: primaryRateByClass.get(row.id) ?? null,
    }));
  }

  /**
   * PLN-260719 D — 강사 참조 해석. teacherTchId 우선(강사 마스터), legacy
   * teacherUserId 만 오면 tch 역조회. 반환: dual-write 용 { tchId, userId }.
   */
  private async resolveTeacherRef(
    entId: string,
    teacherTchId?: string | null,
    teacherUserId?: string | null,
  ): Promise<{ tchId: string | null; userId: string | null }> {
    if (teacherTchId) {
      const rows: Array<{ tch_id: string; tch_user_id: string | null }> =
        await this.ds.query(
          `SELECT tch_id, tch_user_id FROM amb_acm_tch_teacher
            WHERE ent_id = $1 AND tch_id = $2 AND deleted_at IS NULL`,
          [entId, teacherTchId],
        );
      if (!rows[0]) throw new BadRequestException('TEACHER_NOT_FOUND');
      return { tchId: rows[0].tch_id, userId: rows[0].tch_user_id ?? null };
    }
    if (teacherUserId) {
      const rows: Array<{ tch_id: string }> = await this.ds.query(
        `SELECT tch_id FROM amb_acm_tch_teacher
          WHERE ent_id = $1 AND tch_user_id = $2 AND deleted_at IS NULL`,
        [entId, teacherUserId],
      );
      return { tchId: rows[0]?.tch_id ?? null, userId: teacherUserId };
    }
    throw new BadRequestException('TEACHER_REQUIRED');
  }

  /** 수업별 강사명 — tch 마스터 우선, 콘솔계정(user) fallback. Map<clsId, name>. */
  private async teacherNamesForClasses(
    entId: string,
    classes: Array<
      Pick<ClassTypeormEntity, 'id' | 'teacherTchId' | 'teacherUserId'>
    >,
  ): Promise<Map<string, string>> {
    const tchIds = Array.from(
      new Set(
        classes.map((c) => c.teacherTchId).filter((v): v is string => !!v),
      ),
    );
    const tchNames = new Map<string, string>();
    if (tchIds.length > 0) {
      const rows: Array<{ tch_id: string; tch_name: string }> =
        await this.ds.query(
          `SELECT tch_id, tch_name FROM amb_acm_tch_teacher
          WHERE ent_id = $1 AND tch_id = ANY($2::uuid[])`,
          [entId, tchIds],
        );
      for (const r of rows) tchNames.set(r.tch_id, r.tch_name);
    }
    const userMap = await this.lookupTeacherNames(
      entId,
      classes.filter((c) => !c.teacherTchId).map((c) => c.teacherUserId),
    );
    const out = new Map<string, string>();
    for (const c of classes) {
      const name = c.teacherTchId
        ? tchNames.get(c.teacherTchId)
        : c.teacherUserId
          ? userMap.get(c.teacherUserId)
          : undefined;
      if (name) out.set(c.id, name);
    }
    return out;
  }

  private async lookupTeacherNames(
    entId: string,
    userIds: Array<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const ids = Array.from(
      new Set(
        userIds.filter(
          (value): value is string =>
            typeof value === 'string' && value.length > 0,
        ),
      ),
    );
    if (ids.length === 0) return new Map();
    const rows = await this.userRepo.find({
      where: { entId, id: In(ids) },
      select: ['id', 'name'],
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  private async lookupStudentNames(
    entId: string,
    studentIds: string[],
  ): Promise<Map<string, string>> {
    const ids = Array.from(new Set(studentIds.filter(Boolean)));
    if (ids.length === 0) return new Map();
    const rows = await this.stdRepo.find({
      where: { entId, id: In(ids), deletedAt: IsNull() },
      select: ['id', 'name'],
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  private async assertCourseExists(
    entId: string,
    courseId: string,
  ): Promise<void> {
    // Only an active course in this tenant may be linked; inactive/unknown
    // ids are rejected so classes cannot point at retired catalog entries.
    const exists = await this.courseRepo.exist({
      where: { entId, id: courseId, isActive: true },
    });
    if (!exists) {
      throw new BadRequestException('VAL_COURSE_NOT_FOUND');
    }
  }
}
