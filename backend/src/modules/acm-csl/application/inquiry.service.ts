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
  UpdateInquiryDto,
  UpsertEnrollmentDto,
  UpsertMapTestDto,
} from './dto/inquiry.dto';

/**
 * 6-stage CSL pipeline transition matrix (acm-req-csl-001 v2.1 §4.1, §4.4).
 * INTAKE → MAP_TEST | TRIAL_CLASS (skip per Q-CSL-003) | DROPPED
 * MAP_TEST → TRIAL_CLASS | DROPPED
 * TRIAL_CLASS → ENROLLMENT_COUNSELING | DROPPED
 * ENROLLMENT_COUNSELING → PAYMENT | DROPPED
 * PAYMENT → CLASS_STARTED | DROPPED
 * CLASS_STARTED → DROPPED (terminal otherwise; CLS module owns ongoing state)
 * DROPPED → previousStage (reactivation per C-14)
 */
const FORWARD_TRANSITIONS: Record<CslStage, CslStage[]> = {
  INTAKE: ['MAP_TEST', 'TRIAL_CLASS', 'DROPPED'],
  MAP_TEST: ['TRIAL_CLASS', 'DROPPED'],
  TRIAL_CLASS: ['ENROLLMENT_COUNSELING', 'DROPPED'],
  ENROLLMENT_COUNSELING: ['PAYMENT', 'DROPPED'],
  PAYMENT: ['CLASS_STARTED', 'DROPPED'],
  CLASS_STARTED: ['DROPPED'],
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
  ) {}

  // ──────────────────────────────────────────────────────────────────────
  // CRUD
  // ──────────────────────────────────────────────────────────────────────
  async create(entId: string, dto: CreateInquiryDto, actorId?: string) {
    if (!dto.schoolId && !dto.schoolFreetext) {
      throw new BadRequestException('schoolId or schoolFreetext required (C-105)');
    }
    if (dto.applyPurpose === 'OTHER' && !dto.applyPurposeOther) {
      throw new BadRequestException('applyPurposeOther required when applyPurpose=OTHER');
    }

    // Allocate per-tenant sequential number
    const rows: Array<{ next: number }> = await this.ds.query(
      'SELECT acm_csl_next_seq_no($1) AS next',
      [entId],
    );
    const seqNo = Number(rows[0]?.next ?? 0);

    // Encrypt PII
    const nameEnc = this.crypto.encrypt(dto.studentName);
    const phoneStatus = dto.phoneStatus ?? (dto.parentPhone ? 'PROVIDED' : 'UNKNOWN');
    const phoneEnc =
      phoneStatus === 'PROVIDED' && dto.parentPhone
        ? this.crypto.encrypt(dto.parentPhone)
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
      inflowType: dto.inflowType,
      applyType: dto.applyType,
      applyPurpose: dto.applyPurpose ?? null,
      applyPurposeOther: dto.applyPurposeOther ?? null,
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
    opts: { stage?: CslStage; limit?: number; offset?: number } = {},
  ) {
    const { stage, limit = 50, offset = 0 } = opts;
    const where = stage
      ? { entId, currentStage: stage, deletedAt: IsNull() }
      : { entId, deletedAt: IsNull() };
    const [items, total] = await this.inq.findAndCount({
      where,
      take: limit,
      skip: offset,
      order: { seqNo: 'DESC' },
    });
    return { items: items.map((e) => this.toView(e)), total };
  }

  async findOne(entId: string, id: string) {
    const e = await this.getOrThrow(entId, id);
    return this.toView(e);
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
    if (dto.schoolId !== undefined) e.schoolId = dto.schoolId ?? null;
    if (dto.schoolFreetext !== undefined) e.schoolFreetext = dto.schoolFreetext ?? null;
    if (dto.grade !== undefined) e.grade = dto.grade ?? null;
    if (dto.inflowType !== undefined) e.inflowType = dto.inflowType;
    if (dto.applyType !== undefined) e.applyType = dto.applyType;
    if (dto.applyPurpose !== undefined) e.applyPurpose = dto.applyPurpose ?? null;
    if (dto.applyPurposeOther !== undefined)
      e.applyPurposeOther = dto.applyPurposeOther ?? null;
    if (dto.consultDone !== undefined) e.consultDone = dto.consultDone ?? null;
    if (dto.registeredAt !== undefined) e.registeredAt = dto.registeredAt;
    if (dto.followupAt !== undefined) e.followupAt = dto.followupAt ?? null;
    if (dto.followupMemo !== undefined) e.followupMemo = dto.followupMemo ?? null;

    if (e.applyPurpose === 'OTHER' && !e.applyPurposeOther) {
      throw new BadRequestException('applyPurposeOther required when applyPurpose=OTHER');
    }
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
      throw new BadRequestException('waiverReason required when feeStatus=WAIVED');
    }
    let mt = await this.mapTests.findOne({ where: { inqId, entId } });
    if (!mt) {
      mt = this.mapTests.create({ id: randomUUID(), entId, inqId });
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
    });
    return this.mapTests.save(mt);
  }

  getMapTest(entId: string, inqId: string) {
    return this.mapTests.findOne({ where: { inqId, entId } });
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
      }),
    );
  }

  listTrialClasses(entId: string, inqId: string) {
    return this.trialClasses.find({
      where: { entId, inqId },
      order: { heldAt: 'ASC' },
    });
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
        throw new ForbiddenException('BR-CSL-012: only senior manager can mark tuition paid');
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
    if (dto.tuitionAmount !== undefined) er.tuitionAmount = String(dto.tuitionAmount);
    if (dto.classStartedAt !== undefined) er.classStartedAt = dto.classStartedAt;
    if (dto.classStarted !== undefined) er.classStarted = dto.classStarted;
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
      throw new BadRequestException('reasonOther required when reasonCode=OTHER');
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
      throw new BadRequestException(`Cannot transition ${e.currentStage} → ${toStage}`);
    }
    // Anonymous inquiries cannot progress past INTAKE
    if (e.isAnonymous && toStage !== 'DROPPED') {
      throw new BadRequestException(
        'Anonymous inquiry cannot progress past INTAKE — provide student name first',
      );
    }
    // Stage entry gates
    await this.assertEntryGate(entId, inqId, e.currentStage, toStage);

    return this.applyTransition(entId, e, toStage, 'FORWARD', undefined, note, actorId);
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
        throw new BadRequestException('ENROLLMENT_COUNSELING requires at least one trial class');
      }
    }
    if (toStage === 'PAYMENT') {
      const er = await this.enrollments.findOne({ where: { entId, inqId } });
      if (!er || er.counselDone !== 'YES') {
        throw new BadRequestException('PAYMENT entry requires enrollment counseling completed');
      }
    }
    if (toStage === 'CLASS_STARTED') {
      const er = await this.enrollments.findOne({ where: { entId, inqId } });
      if (!er || er.tuitionPaid !== true) {
        throw new BadRequestException('CLASS_STARTED entry requires tuition paid');
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
    }
    return { id: saved.id, fromStage, toStage, currentStage: saved.currentStage };
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
    return {
      id: e.id,
      entId: e.entId,
      seqNo: e.seqNo,
      registeredAt: e.registeredAt,
      followupAt: e.followupAt,
      followupMemo: e.followupMemo,
      studentName,
      isAnonymous: e.isAnonymous,
      parentPhone, // ⚠ revealed on detail per existing convention; mask in list view client-side
      phoneStatus: e.phoneStatus,
      schoolId: e.schoolId,
      schoolFreetext: e.schoolFreetext,
      grade: e.grade,
      inflowType: e.inflowType,
      applyType: e.applyType,
      applyPurpose: e.applyPurpose,
      applyPurposeOther: e.applyPurposeOther,
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
