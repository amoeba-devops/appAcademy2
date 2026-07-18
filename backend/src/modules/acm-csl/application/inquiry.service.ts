import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { ACM_DS } from '../../acm-common/datasource';
import {
  InquiryTypeormEntity,
  type CslStage,
  type ApplyPurpose,
  type ApplyType,
  type InflowType,
} from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { MapTestTypeormEntity } from '../infrastructure/typeorm/map-test.typeorm-entity';
import { TrialClassTypeormEntity } from '../infrastructure/typeorm/trial-class.typeorm-entity';
import { EnrollmentTypeormEntity } from '../infrastructure/typeorm/enrollment.typeorm-entity';
import { CancellationTypeormEntity } from '../infrastructure/typeorm/cancellation.typeorm-entity';
import { TransitionTypeormEntity } from '../infrastructure/typeorm/transition.typeorm-entity';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  CreateCancellationDto,
  CreateInquiryDto,
  CreateTrialClassDto,
  RecordLevelTestResultDto,
  UpdateInquiryDto,
  UpsertEnrollmentDto,
  UpsertMapTestDto,
} from './dto/inquiry.dto';
import { validateLevelTestScoreDetail } from './dto/level-test-score.validator';
import { StdInheritanceService } from './std-inheritance.service';
import { CslEnrollmentRegistrationService } from './csl-enrollment-registration.service';

/**
 * 6-stage CSL pipeline transition matrix (acm-req-csl-001 v2.1 §4.1, §4.4).
 * INTAKE → MAP_TEST | TRIAL_CLASS (skip per Q-CSL-003) | DROPPED
 * MAP_TEST → TRIAL_CLASS | DROPPED
 * TRIAL_CLASS → ENROLLMENT_COUNSELING | DROPPED
 * ENROLLMENT_COUNSELING → PAYMENT | DROPPED
 * PAYMENT → CLASS_STARTED | DROPPED
 * CLASS_STARTED → ATTENDING (수강중, PLN-260714) | DROPPED
 * ATTENDING → DROPPED (수강중 상담을 상담종료로 마감)
 * DROPPED → previousStage (reactivation per C-14)
 */
const FORWARD_TRANSITIONS: Record<CslStage, CslStage[]> = {
  INTAKE: ['MAP_TEST', 'TRIAL_CLASS', 'DROPPED'],
  MAP_TEST: ['TRIAL_CLASS', 'DROPPED'],
  TRIAL_CLASS: ['ENROLLMENT_COUNSELING', 'DROPPED'],
  ENROLLMENT_COUNSELING: ['PAYMENT', 'DROPPED'],
  PAYMENT: ['CLASS_STARTED', 'DROPPED'],
  CLASS_STARTED: ['ATTENDING', 'DROPPED'],
  ATTENDING: ['DROPPED'],
  DROPPED: [],
};

@Injectable()
export class InquiryService {
  constructor(
    @InjectRepository(InquiryTypeormEntity, ACM_DS)
    private readonly inq: Repository<InquiryTypeormEntity>,
    @InjectRepository(MapTestTypeormEntity, ACM_DS)
    private readonly mapTests: Repository<MapTestTypeormEntity>,
    @InjectRepository(TrialClassTypeormEntity, ACM_DS)
    private readonly trialClasses: Repository<TrialClassTypeormEntity>,
    @InjectRepository(EnrollmentTypeormEntity, ACM_DS)
    private readonly enrollments: Repository<EnrollmentTypeormEntity>,
    @InjectRepository(CancellationTypeormEntity, ACM_DS)
    private readonly cancellations: Repository<CancellationTypeormEntity>,
    @InjectRepository(TransitionTypeormEntity, ACM_DS)
    private readonly transitions: Repository<TransitionTypeormEntity>,
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly crypto: AesGcmService,
    private readonly events: EventEmitter2,
    private readonly stdInheritance: StdInheritanceService,
    private readonly enrollmentRegistration: CslEnrollmentRegistrationService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────
  // CRUD
  // ──────────────────────────────────────────────────────────────────────
  async create(entId: string, dto: CreateInquiryDto, actorId?: string) {
    if (!dto.schoolId && !dto.schoolFreetext) {
      throw new BadRequestException(
        'schoolId or schoolFreetext required (C-105)',
      );
    }

    // Allocate per-tenant sequential number
    const rows: Array<{ next: number }> = await this.ds.query(
      'SELECT acm_csl_next_seq_no($1) AS next',
      [entId],
    );
    const seqNo = Number(rows[0]?.next ?? 0);

    // Encrypt PII
    const nameEnc = this.crypto.encrypt(dto.studentName);
    const phoneStatus =
      dto.phoneStatus ?? (dto.parentPhone ? 'PROVIDED' : 'UNKNOWN');
    const phoneEnc =
      phoneStatus === 'PROVIDED' && dto.parentPhone
        ? this.crypto.encrypt(dto.parentPhone)
        : null;
    const parentNameEnc = dto.parentName
      ? this.crypto.encrypt(dto.parentName)
      : null;

    const today = new Date().toISOString().slice(0, 10);

    const entity = this.inq.create({
      id: randomUUID(),
      entId,
      seqNo,
      registeredAt: dto.registeredAt ?? today,
      followupAt: dto.followupAt ?? null,
      followupMemo: dto.followupMemo ?? null,
      nameEncrypted: nameEnc.ciphertext,
      nameIv: nameEnc.iv,
      nameAuthTag: nameEnc.authTag,
      isAnonymous: dto.isAnonymous ?? false,
      phoneEncrypted: phoneEnc?.ciphertext ?? null,
      phoneIv: phoneEnc?.iv ?? null,
      phoneAuthTag: phoneEnc?.authTag ?? null,
      phoneStatus,
      parentNameEncrypted: parentNameEnc?.ciphertext ?? null,
      parentNameIv: parentNameEnc?.iv ?? null,
      parentNameAuthTag: parentNameEnc?.authTag ?? null,
      inflowType: dto.inflowType,
      applyType: dto.applyType,
      applyPurpose: dto.applyPurposes?.length
        ? dto.applyPurposes.join(',')
        : null,
      applyPurposeOther: null,
      consultDone: dto.consultDone ?? null,
      schoolId: dto.schoolId ?? null,
      schoolFreetext: dto.schoolFreetext ?? null,
      grade: dto.grade ?? null,
      currentStage: 'INTAKE',
      previousStage: null,
    });
    const saved = await this.inq.save(entity);

    this.events.emit('acm.csl.created', {
      entId,
      occurredAt: new Date().toISOString(),
      actorId,
      inqId: saved.id,
      seqNo,
      isAnonymous: saved.isAnonymous,
      inflowType: saved.inflowType,
      applyType: saved.applyType,
    });
    return this.toView(saved);
  }

  async list(
    entId: string,
    opts: {
      stage?: CslStage;
      q?: string;
      inflowType?: InflowType;
      applyType?: ApplyType;
      applyPurpose?: ApplyPurpose;
      registeredFrom?: string;
      registeredTo?: string;
      followupState?: 'SET' | 'EMPTY';
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const {
      stage,
      q,
      inflowType,
      applyType,
      applyPurpose,
      registeredFrom,
      registeredTo,
      followupState,
      limit = 50,
      offset = 0,
    } = opts;

    const qb = this.inq
      .createQueryBuilder('inq')
      .where('inq.ent_id = :entId', { entId })
      .andWhere('inq.deleted_at IS NULL');

    if (stage) {
      qb.andWhere('inq.inq_current_stage = :stage', { stage });
    }
    if (inflowType) {
      qb.andWhere('inq.inq_inflow_type = :inflowType', { inflowType });
    }
    if (applyType) {
      qb.andWhere('inq.inq_apply_type = :applyType', { applyType });
    }
    if (applyPurpose) {
      qb.andWhere('inq.inq_apply_purpose ILIKE :applyPurpose', {
        applyPurpose: `%${applyPurpose}%`,
      });
    }
    if (registeredFrom) {
      qb.andWhere('inq.inq_registered_at >= :registeredFrom', {
        registeredFrom,
      });
    }
    if (registeredTo) {
      qb.andWhere('inq.inq_registered_at <= :registeredTo', { registeredTo });
    }
    if (followupState === 'SET') {
      qb.andWhere('inq.inq_followup_at IS NOT NULL');
    }
    if (followupState === 'EMPTY') {
      qb.andWhere('inq.inq_followup_at IS NULL');
    }

    qb.orderBy('inq.inq_seq_no', 'DESC');

    if (q && q.trim()) {
      const needle = q.trim().toLocaleLowerCase();
      const rows = await qb.getMany();
      const filtered = rows
        .map((e) => this.toView(e))
        .filter((row) => {
          const student = row.studentName?.toLocaleLowerCase() ?? '';
          const parent = row.parentName?.toLocaleLowerCase() ?? '';
          return student.includes(needle) || parent.includes(needle);
        });
      return {
        items: await this.attachLinkedStudents(
          entId,
          filtered.slice(offset, offset + limit),
        ),
        total: filtered.length,
      };
    }

    const [items, total] = await qb
      .clone()
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return {
      items: await this.attachLinkedStudents(
        entId,
        items.map((e) => this.toView(e)),
      ),
      total,
    };
  }

  async findOne(entId: string, id: string) {
    const e = await this.getOrThrow(entId, id);
    const [view] = await this.attachLinkedStudents(entId, [this.toView(e)]);
    return view;
  }

  /**
   * PLN-260718 요구3 — 신규상담이 수강등록으로 이어져 STD 학생이 생성된 경우
   * 연결된 학생(이름·상태·id)을 뷰에 붙인다. inq_std_id 기반 배치 조회.
   */
  private async lookupLinkedStudents(
    entId: string,
    stdIds: Array<string | null | undefined>,
  ): Promise<Map<string, { id: string; name: string; status: string }>> {
    const ids = Array.from(
      new Set(
        stdIds.filter(
          (x): x is string => typeof x === 'string' && x.length > 0,
        ),
      ),
    );
    const map = new Map<string, { id: string; name: string; status: string }>();
    if (ids.length === 0) return map;
    const rows: Array<{ id: string; name: string; status: string }> =
      await this.ds.query(
        `SELECT std_id AS id, std_name AS name, std_status AS status
           FROM amb_acm_std_student
          WHERE ent_id = $1 AND std_id = ANY($2::uuid[]) AND deleted_at IS NULL`,
        [entId, ids],
      );
    for (const r of rows)
      map.set(r.id, { id: r.id, name: r.name, status: r.status });
    return map;
  }

  private async attachLinkedStudents<T extends { stdId: string | null }>(
    entId: string,
    views: T[],
  ): Promise<
    Array<
      T & { linkedStudent: { id: string; name: string; status: string } | null }
    >
  > {
    const map = await this.lookupLinkedStudents(
      entId,
      views.map((v) => v.stdId),
    );
    return views.map((v) => ({
      ...v,
      linkedStudent: v.stdId ? (map.get(v.stdId) ?? null) : null,
    }));
  }

  async update(entId: string, id: string, dto: UpdateInquiryDto) {
    const e = await this.getOrThrow(entId, id);

    if (dto.studentName !== undefined) {
      const enc = this.crypto.encrypt(dto.studentName);
      e.nameEncrypted = enc.ciphertext;
      e.nameIv = enc.iv;
      e.nameAuthTag = enc.authTag;
    }
    if (dto.isAnonymous !== undefined) e.isAnonymous = dto.isAnonymous;
    if (dto.phoneStatus !== undefined) e.phoneStatus = dto.phoneStatus;
    if (dto.parentPhone !== undefined) {
      if (dto.parentPhone) {
        const enc = this.crypto.encrypt(dto.parentPhone);
        e.phoneEncrypted = enc.ciphertext;
        e.phoneIv = enc.iv;
        e.phoneAuthTag = enc.authTag;
        if (e.phoneStatus !== 'PROVIDED') e.phoneStatus = 'PROVIDED';
      } else {
        e.phoneEncrypted = null;
        e.phoneIv = null;
        e.phoneAuthTag = null;
      }
    }
    if (dto.parentName !== undefined) {
      if (dto.parentName) {
        const enc = this.crypto.encrypt(dto.parentName);
        e.parentNameEncrypted = enc.ciphertext;
        e.parentNameIv = enc.iv;
        e.parentNameAuthTag = enc.authTag;
      } else {
        e.parentNameEncrypted = null;
        e.parentNameIv = null;
        e.parentNameAuthTag = null;
      }
    }
    if (dto.schoolId !== undefined) e.schoolId = dto.schoolId ?? null;
    if (dto.schoolFreetext !== undefined)
      e.schoolFreetext = dto.schoolFreetext ?? null;
    if (dto.grade !== undefined) e.grade = dto.grade ?? null;
    if (dto.inflowType !== undefined) e.inflowType = dto.inflowType;
    if (dto.applyType !== undefined) e.applyType = dto.applyType;
    if (dto.applyPurposes !== undefined)
      e.applyPurpose = dto.applyPurposes?.length
        ? dto.applyPurposes.join(',')
        : null;
    if (dto.consultDone !== undefined) e.consultDone = dto.consultDone ?? null;
    if (dto.registeredAt !== undefined) e.registeredAt = dto.registeredAt;
    if (dto.followupAt !== undefined) e.followupAt = dto.followupAt ?? null;
    if (dto.followupMemo !== undefined)
      e.followupMemo = dto.followupMemo ?? null;

    return this.toView(await this.inq.save(e));
  }

  async softDelete(entId: string, id: string): Promise<void> {
    await this.getOrThrow(entId, id);
    await this.inq.softDelete({ id, entId });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Sub-resource: MAP test
  // ──────────────────────────────────────────────────────────────────────
  async upsertMapTest(entId: string, inqId: string, dto: UpsertMapTestDto) {
    await this.getOrThrow(entId, inqId);
    if (dto.feeStatus === 'WAIVED' && !dto.waiverReason) {
      throw new BadRequestException(
        'waiverReason required when feeStatus=WAIVED',
      );
    }
    let mt = await this.mapTests.findOne({ where: { inqId, entId } });
    if (!mt) {
      mt = this.mapTests.create({ id: randomUUID(), entId, inqId });
    }

    // REQ-260626 — when scoreDetail is provided, validate against the
    // schema for the *effective* testType (incoming dto override else stored).
    let normalizedDetail: Record<string, unknown> | null | undefined =
      undefined;
    if (dto.scoreDetail !== undefined) {
      const effectiveType = dto.testType ?? mt.testType ?? 'MAP';
      normalizedDetail = validateLevelTestScoreDetail(
        effectiveType,
        dto.scoreDetail,
      );
    }

    Object.assign(mt, {
      hasPriorScore: dto.hasPriorScore ?? mt.hasPriorScore ?? null,
      feeStatus: dto.feeStatus ?? mt.feeStatus ?? null,
      waiverReason: dto.waiverReason ?? mt.waiverReason ?? null,
      waiverNote: dto.waiverNote ?? mt.waiverNote ?? null,
      scheduledAt: dto.scheduledAt ?? mt.scheduledAt ?? null,
      scheduledStatus: dto.scheduledStatus ?? mt.scheduledStatus ?? null,
      scoreReading: dto.scoreReading ?? mt.scoreReading ?? null,
      scoreMath: dto.scoreMath ?? mt.scoreMath ?? null,
      scoreLanguage: dto.scoreLanguage ?? mt.scoreLanguage ?? null,
      // REQ-260626 additions
      testType: dto.testType ?? mt.testType ?? 'MAP',
      testTypeOther: dto.testTypeOther ?? mt.testTypeOther ?? null,
      scheduledTime: dto.scheduledTime ?? mt.scheduledTime ?? null,
      ...(normalizedDetail !== undefined
        ? { scoreDetail: normalizedDetail }
        : {}),
      // DSN-260629 — INTAKE prior scores. Pass-through (no per-key validation v1).
      ...(dto.priorScoresDetail !== undefined
        ? {
            priorScoresDetail:
              Object.keys(dto.priorScoresDetail).length === 0
                ? null
                : dto.priorScoresDetail,
          }
        : {}),
    });
    return this.mapTests.save(mt);
  }

  /**
   * REQ-260626 FR-CSL-115 / Q-CSL-111 — operator-only result recording.
   * Persists scores + actor/at audit fields. Caller (controller) enforces
   * the STAFF↑ role gate; this service only stamps the actor it receives.
   */
  async recordLevelTestResult(
    entId: string,
    inqId: string,
    dto: RecordLevelTestResultDto,
    actorId: string,
  ) {
    await this.getOrThrow(entId, inqId);
    const mt = await this.mapTests.findOne({ where: { inqId, entId } });
    if (!mt) {
      throw new NotFoundException(
        'Level-test row not found — operator must schedule before recording a result',
      );
    }

    const normalizedDetail = validateLevelTestScoreDetail(
      dto.testType,
      dto.scoreDetail,
    );

    if (dto.testType === 'MAP') {
      // MAP path: dedicated columns; reject scoreDetail (validator already
      // does, but be defensive here too).
      Object.assign(mt, {
        testType: 'MAP',
        scoreReading: dto.scoreReading ?? mt.scoreReading ?? null,
        scoreMath: dto.scoreMath ?? mt.scoreMath ?? null,
        scoreLanguage: dto.scoreLanguage ?? mt.scoreLanguage ?? null,
        scoreDetail: null,
      });
    } else {
      // Non-MAP path: clear dedicated columns, persist JSONB.
      Object.assign(mt, {
        testType: dto.testType,
        scoreReading: null,
        scoreMath: null,
        scoreLanguage: null,
        scoreDetail: normalizedDetail,
      });
    }

    mt.resultEnteredBy = actorId;
    mt.resultEnteredAt = new Date();
    return this.mapTests.save(mt);
  }

  getMapTest(entId: string, inqId: string) {
    // Legacy 1:1 accessor — returns the first row matching (entId, inqId).
    // DSN-260629 §6 moved to 1:N per testType; new callers should use
    // listLevelTests + filtered access.
    return this.mapTests.findOne({ where: { inqId, entId } });
  }

  // ──────────────────────────────────────────────────────────────────────
  // DSN-260629 §6 — per-test-type level-test schedule (1:N)
  //
  //   listLevelTests   — all rows for an inquiry (one per exam type)
  //   getLevelTest     — single row by (inq, type)
  //   upsertLevelTest  — schedule / teacher / status / type_other (NOT scores)
  //   recordLevelTestResultByType — replaces the legacy 1:1 recorder.
  //
  // The legacy 1:1 methods above (upsertMapTest / recordLevelTestResult)
  // stay for back-compat with already-deployed clients.
  // ──────────────────────────────────────────────────────────────────────

  listLevelTests(
    entId: string,
    inqId: string,
  ): Promise<MapTestTypeormEntity[]> {
    return this.mapTests.find({
      where: { entId, inqId },
      order: { testType: 'ASC' },
    });
  }

  getLevelTestByType(
    entId: string,
    inqId: string,
    testType: string,
  ): Promise<MapTestTypeormEntity | null> {
    return this.mapTests.findOne({
      where: {
        entId,
        inqId,
        testType: testType as MapTestTypeormEntity['testType'],
      },
    });
  }

  async upsertLevelTest(
    entId: string,
    inqId: string,
    testType: MapTestTypeormEntity['testType'],
    dto: {
      scheduledAt?: string;
      scheduledTime?: string;
      teacherId?: string;
      status?: 'PENDING' | 'COMPLETED' | 'NOT_HELD';
      testTypeOther?: string;
    },
  ): Promise<MapTestTypeormEntity> {
    await this.getOrThrow(entId, inqId);
    let mt = await this.mapTests.findOne({ where: { entId, inqId, testType } });
    if (!mt) {
      mt = this.mapTests.create({
        id: randomUUID(),
        entId,
        inqId,
        testType,
      });
    }
    if (dto.scheduledAt !== undefined) mt.scheduledAt = dto.scheduledAt ?? null;
    if (dto.scheduledTime !== undefined)
      mt.scheduledTime = dto.scheduledTime ?? null;
    if (dto.teacherId !== undefined) mt.teacherId = dto.teacherId ?? null;
    if (dto.status !== undefined) mt.scheduledStatus = dto.status ?? null;
    if (dto.testTypeOther !== undefined) {
      mt.testTypeOther = dto.testTypeOther ?? null;
    }
    return this.mapTests.save(mt);
  }

  /**
   * DSN-260629 §6 — per-type result entry. Same payload shape as the
   * legacy `recordLevelTestResult` but explicit `testType` param routes
   * to the matching row in the 1:N table.
   */
  async recordLevelTestResultByType(
    entId: string,
    inqId: string,
    testType: MapTestTypeormEntity['testType'],
    dto: {
      scoreReading?: number;
      scoreMath?: number;
      scoreLanguage?: number;
      scoreDetail?: Record<string, unknown>;
    },
    actorId: string,
  ): Promise<MapTestTypeormEntity> {
    await this.getOrThrow(entId, inqId);
    const mt = await this.mapTests.findOne({
      where: { entId, inqId, testType },
    });
    if (!mt) {
      throw new NotFoundException(
        `Level-test row (testType=${testType}) not found — schedule it first`,
      );
    }
    const normalizedDetail = validateLevelTestScoreDetail(
      testType,
      dto.scoreDetail,
    );
    if (testType === 'MAP') {
      Object.assign(mt, {
        scoreReading: dto.scoreReading ?? mt.scoreReading ?? null,
        scoreMath: dto.scoreMath ?? mt.scoreMath ?? null,
        scoreLanguage: dto.scoreLanguage ?? mt.scoreLanguage ?? null,
        scoreDetail: null,
      });
    } else {
      Object.assign(mt, {
        scoreReading: null,
        scoreMath: null,
        scoreLanguage: null,
        scoreDetail: normalizedDetail,
      });
    }
    mt.resultEnteredBy = actorId;
    mt.resultEnteredAt = new Date();
    return this.mapTests.save(mt);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Sub-resource: Trial class
  // ──────────────────────────────────────────────────────────────────────
  async addTrialClass(entId: string, inqId: string, dto: CreateTrialClassDto) {
    await this.getOrThrow(entId, inqId);
    return this.trialClasses.save(
      this.trialClasses.create({
        id: randomUUID(),
        entId,
        inqId,
        heldAt: dto.heldAt,
        feedbackStatus: dto.feedbackStatus ?? 'PENDING',
        note: dto.note ?? null,
        // REQ-260626 additions
        heldTime: dto.heldTime ?? null,
        teacherId: dto.teacherId ?? null,
        completed: false,
      }),
    );
  }

  listTrialClasses(entId: string, inqId: string) {
    return this.trialClasses.find({
      where: { entId, inqId },
      order: { heldAt: 'ASC' },
    });
  }

  /**
   * REQ-260626 FR-CSL-122~125 — partial update of a demo class.
   * Independent fields so operator iterates (schedule → teacher → mark
   * completed → feedback) without re-sending the whole row.
   */
  async updateTrialClass(
    entId: string,
    inqId: string,
    tclId: string,
    patch: {
      heldAt?: string;
      heldTime?: string;
      teacherId?: string;
      completed?: boolean;
      note?: string;
      calEventId?: string;
    },
  ): Promise<TrialClassTypeormEntity> {
    const tc = await this.trialClasses.findOne({
      where: { entId, inqId, id: tclId },
    });
    if (!tc)
      throw new NotFoundException({ code: 'TRIAL_CLASS_NOT_FOUND', tclId });
    if (patch.heldAt !== undefined) tc.heldAt = patch.heldAt;
    if (patch.heldTime !== undefined) tc.heldTime = patch.heldTime ?? null;
    if (patch.teacherId !== undefined) tc.teacherId = patch.teacherId ?? null;
    if (patch.completed !== undefined) tc.completed = patch.completed;
    if (patch.note !== undefined) tc.note = patch.note ?? null;
    if (patch.calEventId !== undefined)
      tc.calEventId = patch.calEventId ?? null;
    return this.trialClasses.save(tc);
  }

  // ──────────────────────────────────────────────────────────────────────
  // REQ-260626 — Demo class feedback workflow (FR-CSL-127/128, FN-CSL-223/224)
  //
  //   TEACHER writes body   → marks authored_by/at + completed=true
  //   STAFF↑  confirms       → stamps confirmed_by/at
  //   STAFF↑  marks delivered → stamps delivered_at (after manual KakaoTalk)
  //
  // Controller enforces role gates; service stamps from the actor it gets.
  // ──────────────────────────────────────────────────────────────────────

  async writeFeedback(
    entId: string,
    inqId: string,
    tclId: string,
    body: string,
    actorId: string,
  ): Promise<TrialClassTypeormEntity> {
    const tc = await this.trialClasses.findOne({
      where: { entId, inqId, id: tclId },
    });
    if (!tc)
      throw new NotFoundException({ code: 'TRIAL_CLASS_NOT_FOUND', tclId });
    tc.feedbackBody = body;
    tc.feedbackAuthoredBy = actorId;
    tc.feedbackAuthoredAt = new Date();
    tc.completed = true; // writing feedback implies the session happened
    return this.trialClasses.save(tc);
  }

  async confirmFeedback(
    entId: string,
    inqId: string,
    tclId: string,
    actorId: string,
  ): Promise<TrialClassTypeormEntity> {
    const tc = await this.trialClasses.findOne({
      where: { entId, inqId, id: tclId },
    });
    if (!tc)
      throw new NotFoundException({ code: 'TRIAL_CLASS_NOT_FOUND', tclId });
    if (!tc.feedbackBody) {
      throw new BadRequestException(
        'Cannot confirm — teacher feedback body is empty',
      );
    }
    tc.feedbackConfirmedBy = actorId;
    tc.feedbackConfirmedAt = new Date();
    return this.trialClasses.save(tc);
  }

  async markFeedbackDelivered(
    entId: string,
    inqId: string,
    tclId: string,
  ): Promise<TrialClassTypeormEntity> {
    const tc = await this.trialClasses.findOne({
      where: { entId, inqId, id: tclId },
    });
    if (!tc)
      throw new NotFoundException({ code: 'TRIAL_CLASS_NOT_FOUND', tclId });
    if (!tc.feedbackConfirmedAt) {
      throw new BadRequestException(
        'Cannot mark delivered — feedback not yet confirmed',
      );
    }
    tc.feedbackDeliveredAt = new Date();
    return this.trialClasses.save(tc);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Sub-resource: Enrollment
  // ──────────────────────────────────────────────────────────────────────
  async upsertEnrollment(
    entId: string,
    inqId: string,
    dto: UpsertEnrollmentDto,
    actor: { id?: string; isSeniorManager?: boolean } = {},
  ) {
    await this.getOrThrow(entId, inqId);
    let er = await this.enrollments.findOne({ where: { inqId, entId } });
    if (!er) {
      er = this.enrollments.create({ id: randomUUID(), entId, inqId });
    }
    if (dto.tuitionPaid !== undefined && dto.tuitionPaid !== er.tuitionPaid) {
      if (!actor.isSeniorManager) {
        throw new ForbiddenException(
          'BR-CSL-012: only senior manager can mark tuition paid',
        );
      }
      er.tuitionPaid = dto.tuitionPaid;
      er.tuitionPaidActorId = actor.id ?? null;
      er.tuitionPaidAt = new Date();
    }
    if (dto.paymentNoticeStatus !== undefined)
      er.paymentNoticeStatus = dto.paymentNoticeStatus ?? null;
    if (dto.counselDone !== undefined) er.counselDone = dto.counselDone ?? null;
    if (dto.applied !== undefined) er.applied = dto.applied;
    if (dto.paymentNoticeSent !== undefined)
      er.paymentNoticeSent = dto.paymentNoticeSent ?? null;
    if (dto.classMinutes !== undefined) er.classMinutes = dto.classMinutes;
    if (dto.tuitionAmount !== undefined)
      er.tuitionAmount = String(dto.tuitionAmount);
    if (dto.paymentDate !== undefined) er.paymentDate = dto.paymentDate ?? null;
    if (dto.paymentMethod !== undefined)
      er.paymentMethod = dto.paymentMethod ?? null;
    if (dto.paymentAmount !== undefined)
      er.paymentAmount = String(dto.paymentAmount);
    if (dto.paymentMemo !== undefined) er.paymentMemo = dto.paymentMemo ?? null;
    if (dto.classStartedAt !== undefined)
      er.classStartedAt = dto.classStartedAt;
    if (dto.classStarted !== undefined) er.classStarted = dto.classStarted;

    // REQ-260626 (FR-CSL-131~135)
    if (dto.counselMemo !== undefined) er.counselMemo = dto.counselMemo ?? null;
    if (dto.courseId !== undefined) er.courseId = dto.courseId ?? null;
    if (dto.courseFreetext !== undefined)
      er.courseFreetext = dto.courseFreetext ?? null;
    if (dto.sessionCount !== undefined)
      er.sessionCount = dto.sessionCount ?? null;
    if (dto.startDate !== undefined) er.startDate = dto.startDate ?? null;
    if (dto.endDate !== undefined) er.endDate = dto.endDate ?? null;
    return this.enrollments.save(er);
  }

  /**
   * REQ-260626 FR-CSL-141/142 — explicit payment approval. ADMIN/APP_ADMIN
   * only. Idempotent: re-approving a row already paid is a no-op (actor/at
   * preserved). Distinct from upsertEnrollment so the role gate has a
   * single, audit-friendly surface area.
   */
  async approvePayment(
    entId: string,
    inqId: string,
    method: 'CARD' | 'BANK_TRANSFER' | 'OTHER',
    memo: string | undefined,
    actor: { id: string; isSeniorManager: boolean },
  ) {
    if (!actor.isSeniorManager) {
      throw new ForbiddenException(
        'BR-CSL-012: only senior manager can approve payment',
      );
    }
    await this.getOrThrow(entId, inqId);
    let er = await this.enrollments.findOne({ where: { inqId, entId } });
    if (!er) {
      er = this.enrollments.create({ id: randomUUID(), entId, inqId });
    }
    if (er.tuitionPaid === true) {
      // already approved — return current row unchanged (idempotent).
      return er;
    }
    er.tuitionPaid = true;
    er.tuitionPaidActorId = actor.id;
    er.tuitionPaidAt = new Date();
    er.paymentMethod = method;
    if (memo !== undefined) er.paymentMemo = memo;
    // method/memo go into the memo field so audit captures what the operator
    // saw (card vs bank transfer). counselMemo already covers free-form
    // counsel notes; we append rather than overwrite.
    const tag = `[payment-approved method=${method}${memo ? ` memo=${memo}` : ''}]`;
    er.counselMemo = er.counselMemo ? `${er.counselMemo}\n${tag}` : tag;
    return this.enrollments.save(er);
  }

  getEnrollment(entId: string, inqId: string) {
    return this.enrollments.findOne({ where: { inqId, entId } });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Sub-resource: Cancellation
  // ──────────────────────────────────────────────────────────────────────
  async addCancellation(
    entId: string,
    inqId: string,
    dto: CreateCancellationDto,
    actorId?: string,
  ) {
    await this.getOrThrow(entId, inqId);
    if (dto.reasonCode === 'OTHER' && !dto.reasonOther) {
      throw new BadRequestException(
        'reasonOther required when reasonCode=OTHER',
      );
    }
    return this.cancellations.save(
      this.cancellations.create({
        id: randomUUID(),
        entId,
        inqId,
        reasonCode: dto.reasonCode,
        reasonOther: dto.reasonOther ?? null,
        actorId: actorId ?? null,
      }),
    );
  }

  listCancellations(entId: string, inqId: string) {
    return this.cancellations.find({
      where: { entId, inqId },
      order: { occurredAt: 'ASC' },
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Stage transitions (forward + dropped + reactivation)
  // ──────────────────────────────────────────────────────────────────────
  async forwardStage(
    entId: string,
    inqId: string,
    toStage: CslStage,
    note: string | undefined,
    actorId?: string,
  ) {
    const e = await this.getOrThrow(entId, inqId);
    const allowed = FORWARD_TRANSITIONS[e.currentStage];
    if (!allowed.includes(toStage)) {
      throw new BadRequestException(
        `Cannot transition ${e.currentStage} → ${toStage}`,
      );
    }
    // Anonymous inquiries cannot progress past INTAKE
    if (e.isAnonymous && toStage !== 'DROPPED') {
      throw new BadRequestException(
        'Anonymous inquiry cannot progress past INTAKE — provide student name first',
      );
    }
    // Stage entry gates
    await this.assertEntryGate(entId, inqId, e.currentStage, toStage);

    return this.applyTransition(
      entId,
      e,
      toStage,
      'FORWARD',
      undefined,
      note,
      actorId,
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────
  async getOrThrow(entId: string, inqId: string) {
    const e = await this.inq.findOne({
      where: { id: inqId, entId, deletedAt: IsNull() },
    });
    if (!e) throw new NotFoundException(`Inquiry ${inqId} not found`);
    return e;
  }

  /**
   * Stage entry gates per acm-req-csl-001 v2.1 §4.1:
   *  - MAP_TEST: nothing required (recording stage)
   *  - TRIAL_CLASS: skip from INTAKE allowed only when MAP test has prior_score=true
   *    or fee_status PAID/WAIVED + scheduled_at set, OR scores already recorded.
   *  - ENROLLMENT_COUNSELING: at least one trial class held.
   *  - PAYMENT: enrollment.counsel_done = YES.
   *  - CLASS_STARTED: enrollment.tuition_paid = true.
   */
  private async assertEntryGate(
    entId: string,
    inqId: string,
    fromStage: CslStage,
    toStage: CslStage,
  ): Promise<void> {
    if (toStage === 'TRIAL_CLASS') {
      const mt = await this.mapTests.findOne({ where: { entId, inqId } });
      const passed =
        !!mt &&
        (mt.hasPriorScore === true ||
          mt.feeStatus === 'PAID' ||
          mt.feeStatus === 'WAIVED' ||
          mt.scoreReading != null ||
          mt.scoreMath != null ||
          mt.scoreLanguage != null);
      if (fromStage === 'INTAKE' && !passed) {
        throw new BadRequestException(
          'Skip-to-TRIAL_CLASS requires prior MAP score or paid/waived fee (Q-CSL-003)',
        );
      }
      if (fromStage === 'MAP_TEST' && !passed) {
        throw new BadRequestException(
          'TRIAL_CLASS entry requires recorded MAP score or paid/waived fee',
        );
      }
    }
    if (toStage === 'ENROLLMENT_COUNSELING') {
      const cnt = await this.trialClasses.count({ where: { entId, inqId } });
      if (cnt === 0) {
        throw new BadRequestException(
          'ENROLLMENT_COUNSELING requires at least one trial class',
        );
      }
    }
    if (toStage === 'PAYMENT') {
      const er = await this.enrollments.findOne({ where: { entId, inqId } });
      if (!er || er.counselDone !== 'YES') {
        throw new BadRequestException(
          'PAYMENT entry requires enrollment counseling completed',
        );
      }
    }
    if (toStage === 'CLASS_STARTED') {
      const er = await this.enrollments.findOne({ where: { entId, inqId } });
      if (!er || er.tuitionPaid !== true) {
        throw new BadRequestException(
          'CLASS_STARTED entry requires tuition paid',
        );
      }
    }
    // PLN-260714 — ATTENDING(수강중) requires the student to be registered into
    // STD management first (auto-registration links inq.stdId on CLASS_STARTED).
    if (toStage === 'ATTENDING') {
      const row = await this.inq.findOne({
        where: { id: inqId, entId },
        select: { id: true, stdId: true },
      });
      if (!row?.stdId) {
        throw new BadRequestException(
          'ATTENDING entry requires the student to be registered',
        );
      }
    }
  }

  async applyTransition(
    entId: string,
    inq: InquiryTypeormEntity,
    toStage: CslStage,
    direction: 'FORWARD' | 'BACKWARD' | 'CANCEL' | 'REACTIVATE',
    reasonCode?: string,
    note?: string,
    actorId?: string,
  ) {
    const fromStage = inq.currentStage;
    inq.previousStage = fromStage;
    inq.currentStage = toStage;
    if (toStage === 'CLASS_STARTED') inq.enrolledAt = new Date();
    if (toStage === 'DROPPED') inq.closedAt = new Date();
    if (direction === 'REACTIVATE') inq.closedAt = null;
    const saved = await this.inq.save(inq);

    await this.transitions.save(
      this.transitions.create({
        id: randomUUID(),
        entId,
        inqId: inq.id,
        fromStatus: fromStage,
        toStatus: toStage,
        direction,
        reasonCode: reasonCode ?? null,
        note: note ?? null,
        actorId: actorId ?? null,
      }),
    );

    this.events.emit('acm.csl.stage.changed', {
      entId,
      occurredAt: new Date().toISOString(),
      actorId,
      inqId: inq.id,
      fromStage,
      toStage,
      direction,
    });
    if (toStage === 'CLASS_STARTED') {
      this.events.emit('acm.csl.class_started', {
        entId,
        occurredAt: new Date().toISOString(),
        actorId,
        inqId: inq.id,
      });

      // PLN-260706 — auto-register the student/parent into STD management and
      // issue their portal login accounts. Runs BEFORE MAP inheritance so the
      // student row exists when inheritance matches it. Best-effort: failures
      // must NOT abort the transition (the inquiry is already saved above).
      try {
        await this.enrollmentRegistration.register(entId, inq.id);
      } catch (e) {
        this.events.emit('acm.csl.enrollment_registration_failed', {
          entId,
          inqId: inq.id,
          occurredAt: new Date().toISOString(),
          error: e instanceof Error ? e.message : String(e),
        });
      }

      // REQ-260626 T-19 / Q-CSL-102 — best-effort inherit MAP scores to
      // the matching STD student. Failures here must NOT abort the
      // transition; we already saved the inquiry above.
      try {
        const mt = await this.mapTests.findOne({
          where: { entId, inqId: inq.id },
        });
        await this.stdInheritance.inheritMapScoresOnClassStart(inq, mt);
      } catch (e) {
        // Swallow — surface a structured event so an operator dashboard
        // can flag inquiries whose STD inheritance failed. The transition
        // itself stays successful.
        this.events.emit('acm.csl.std_inheritance_failed', {
          entId,
          inqId: inq.id,
          occurredAt: new Date().toISOString(),
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return {
      id: saved.id,
      fromStage,
      toStage,
      currentStage: saved.currentStage,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // View
  // ──────────────────────────────────────────────────────────────────────
  toView(e: InquiryTypeormEntity) {
    const studentName = this.crypto.decrypt({
      ciphertext: e.nameEncrypted,
      iv: e.nameIv,
      authTag: e.nameAuthTag,
    });
    const parentPhone =
      e.phoneEncrypted && e.phoneIv && e.phoneAuthTag
        ? this.crypto.decrypt({
            ciphertext: e.phoneEncrypted,
            iv: e.phoneIv,
            authTag: e.phoneAuthTag,
          })
        : null;
    const parentName =
      e.parentNameEncrypted && e.parentNameIv && e.parentNameAuthTag
        ? this.crypto.decrypt({
            ciphertext: e.parentNameEncrypted,
            iv: e.parentNameIv,
            authTag: e.parentNameAuthTag,
          })
        : null;
    return {
      id: e.id,
      entId: e.entId,
      seqNo: e.seqNo,
      registeredAt: e.registeredAt,
      followupAt: e.followupAt,
      followupMemo: e.followupMemo,
      studentName,
      isAnonymous: e.isAnonymous,
      parentName,
      parentPhone, // ⚠ revealed on detail per existing convention; mask in list view client-side
      phoneStatus: e.phoneStatus,
      schoolId: e.schoolId,
      schoolFreetext: e.schoolFreetext,
      grade: e.grade,
      stdId: e.stdId ?? null,
      inflowType: e.inflowType,
      applyType: e.applyType,
      applyPurposes: e.applyPurpose
        ? e.applyPurpose.split(',').filter(Boolean)
        : [],
      consultDone: e.consultDone,
      currentStage: e.currentStage,
      previousStage: e.previousStage,
      advisorId: e.advisorId,
      enrolledAt: e.enrolledAt,
      closedAt: e.closedAt,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }
}
