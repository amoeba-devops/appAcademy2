import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { TeacherTypeormEntity } from '../../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmRole } from '../../acm-common/decorators/current-user.decorator';
import { AttachmentTypeormEntity } from '../../acm-csl/infrastructure/typeorm/attachment.typeorm-entity';
import { MapTestTypeormEntity } from '../../acm-csl/infrastructure/typeorm/map-test.typeorm-entity';
import { TrialClassTypeormEntity } from '../../acm-csl/infrastructure/typeorm/trial-class.typeorm-entity';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import {
  CalEventRevisionTypeormEntity,
  type CalEventChange,
} from '../infrastructure/typeorm/cal-event-revision.typeorm-entity';
import { CalInviteeService } from './cal-invitee.service';
import { CalEventAttachmentService } from './cal-event-attachment.service';
import type {
  CreateCalEventDto,
  ListCalEventsQueryDto,
  UpdateCalEventDto,
} from './dto/cal-event.dto';
import {
  InviteeNotifierService,
  NotifySummary,
} from './invitee-notifier.service';
import { BodaRoomService } from './boda-room.service';

export interface CslAttachmentSummary {
  id: string;
  refId: string | null;
  filename: string;
  mime: string;
  sizeBytes: string;
  createdAt: string;
}

export interface CslEventLinkSummary {
  kind: 'DEMO_CLASS' | 'LEVEL_TEST';
  inqId: string;
  refId: string;
  feedbackBody?: string | null;
  attachments: CslAttachmentSummary[];
}

@Injectable()
export class CalEventService {
  constructor(
    @InjectRepository(CalEventTypeormEntity, ACM_DS)
    private readonly repo: Repository<CalEventTypeormEntity>,
    @InjectRepository(CalEventRevisionTypeormEntity, ACM_DS)
    private readonly revisionRepo: Repository<CalEventRevisionTypeormEntity>,
    @InjectRepository(AcmUserTypeormEntity, ACM_DS)
    private readonly userRepo: Repository<AcmUserTypeormEntity>,
    @InjectRepository(TeacherTypeormEntity, ACM_DS)
    private readonly tchRepo: Repository<TeacherTypeormEntity>,
    @InjectRepository(TrialClassTypeormEntity, ACM_DS)
    private readonly trialClassRepo: Repository<TrialClassTypeormEntity>,
    @InjectRepository(MapTestTypeormEntity, ACM_DS)
    private readonly mapTestRepo: Repository<MapTestTypeormEntity>,
    @InjectRepository(AttachmentTypeormEntity, ACM_DS)
    private readonly attachmentRepo: Repository<AttachmentTypeormEntity>,
    private readonly inviteeSvc: CalInviteeService,
    private readonly notifier: InviteeNotifierService,
    private readonly bodaRoomSvc: BodaRoomService,
    private readonly eventAttachmentSvc: CalEventAttachmentService,
  ) {}

  async list(
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
    q: ListCalEventsQueryDto,
  ) {
    const from = new Date(q.from);
    const to = new Date(q.to);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from >= to
    ) {
      throw new BadRequestException('INVALID_RANGE');
    }

    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.entId = :entId', { entId })
      // REQ-260728 — 기본은 미삭제만(캘린더), deletedOnly 면 삭제된 일정만('삭제 보기').
      .andWhere(
        q.deletedOnly ? 'e.deletedAt IS NOT NULL' : 'e.deletedAt IS NULL',
      )
      .andWhere('e.startAt < :to', { to })
      .andWhere('e.endAt > :from', { from });

    if (q.category)
      qb.andWhere('e.category = :category', { category: q.category });

    if (actorRole === 'ADMIN') {
      const ownerIds = Array.from(
        new Set([
          ...(q.ownerUserIds ?? []),
          ...(q.ownerUserId ? [q.ownerUserId] : []),
        ]),
      );
      if (ownerIds.length === 1) {
        qb.andWhere('e.ownerUserId = :owner', { owner: ownerIds[0] });
      } else if (ownerIds.length > 1) {
        qb.andWhere('e.ownerUserId IN (:...ownerIds)', { ownerIds });
      }

      // PLN-260719 D — 강사(tch_id) 필터: 담당강사 OR 강사 참석자 OR
      // 소유자(해당 강사의 연결 콘솔계정이 만든 일정).
      const tchIds = q.assigneeTchIds ?? [];
      if (tchIds.length > 0) {
        qb.andWhere(
          `(e.evt_assignee_tch_id IN (:...tchIds)
            OR EXISTS (
              SELECT 1 FROM amb_acm_cal_invitee ti
              WHERE ti.evt_id = e.evt_id AND ti.ent_id = e.ent_id
                AND ti.inv_kind = 'TEACHER' AND ti.inv_ref_id IN (:...tchIds))
            OR e.evt_owner_user_id IN (
              SELECT t.tch_user_id FROM amb_acm_tch_teacher t
              WHERE t.ent_id = e.ent_id AND t.tch_id IN (:...tchIds)
                AND t.tch_user_id IS NOT NULL))`,
          { tchIds },
        );
      }

      const attendeeIds = Array.from(
        new Set([
          ...(q.attendeeRefIds ?? []),
          ...(q.attendeeRefId ? [q.attendeeRefId] : []),
        ]),
      );
      const hasKind = !!q.attendeeKind;
      const hasRefs = attendeeIds.length > 0;
      if (hasKind !== hasRefs) {
        throw new BadRequestException('INVALID_ATTENDEE_FILTER');
      }
      if (hasKind && hasRefs) {
        qb.andWhere(
          `EXISTS (
             SELECT 1 FROM amb_acm_cal_invitee i
             WHERE i.evt_id     = e.evt_id
               AND i.ent_id     = e.ent_id
               AND i.inv_kind   = :ak
               AND i.inv_ref_id IN (:...ars)
           )`,
          { ak: q.attendeeKind, ars: attendeeIds },
        );
      }
    } else {
      qb.andWhere('e.ownerUserId = :owner', { owner: actorUserId });
    }

    qb.orderBy('e.startAt', 'ASC');
    const items = await qb.getMany();
    return { items: await this.enrichItems(entId, items) };
  }

  /**
   * PLN-260706 §4.4 — portal "my events" list (read-only). Filters to the
   * events the caller is related to by role:
   *   STUDENT → invitee(kind=STUDENT, refId=std_id)
   *   TEACHER → assignee OR invitee(kind=TEACHER, refId=tch_id)
   *   PARENT  → any child (std) is a STUDENT invitee
   */
  async listForPortal(
    entId: string,
    kind: 'STUDENT' | 'PARENT' | 'TEACHER',
    refId: string,
    q: { from: string; to: string; category?: string },
  ) {
    const from = new Date(q.from);
    const to = new Date(q.to);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from >= to
    ) {
      throw new BadRequestException('INVALID_RANGE');
    }

    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.entId = :entId', { entId })
      .andWhere('e.deletedAt IS NULL')
      .andWhere('e.startAt < :to', { to })
      .andWhere('e.endAt > :from', { from });
    if (q.category)
      qb.andWhere('e.category = :category', { category: q.category });

    this.applyPortalScope(qb, kind, refId);

    qb.orderBy('e.startAt', 'ASC');
    const items = await qb.getMany();
    return { items: await this.enrichItems(entId, items) };
  }

  /**
   * PLN-260715 — single event detail for a portal user, scoped identically to
   * listForPortal. 404 when the caller is not related to the event.
   */
  async getForPortal(
    entId: string,
    kind: 'STUDENT' | 'PARENT' | 'TEACHER',
    refId: string,
    evtId: string,
  ) {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.entId = :entId', { entId })
      .andWhere('e.id = :evtId', { evtId })
      .andWhere('e.deletedAt IS NULL');
    this.applyPortalScope(qb, kind, refId);
    const event = await qb.getOne();
    if (!event) throw new NotFoundException('EVENT_NOT_FOUND');
    const [enriched] = await this.enrichItems(entId, [event]);
    // PLN-260718 — 상세 화면 "관련자" 표시용 참석자 목록. 개인정보 최소화를 위해
    // 이름·종류만 노출(이메일 제외).
    const invitees = await this.inviteeSvc.listForEvent(entId, event.id);
    // PLN-260718 P2 — 상세 화면 "첨부자료" 표시용 파일 목록.
    const attachments = await this.eventAttachmentSvc.list(entId, event.id);
    return {
      ...enriched,
      invitees: invitees.map((i) => ({ kind: i.kind, name: i.name })),
      attachments,
    };
  }

  /**
   * PLN-260718 P2 — assert the portal caller is related to the event before
   * streaming an attachment. Reuses the same scope as getForPortal; throws
   * 404 when unrelated so attachment existence isn't leaked.
   */
  async ensurePortalEventAccess(
    entId: string,
    kind: 'STUDENT' | 'PARENT' | 'TEACHER',
    refId: string,
    evtId: string,
  ): Promise<void> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.entId = :entId', { entId })
      .andWhere('e.id = :evtId', { evtId })
      .andWhere('e.deletedAt IS NULL');
    this.applyPortalScope(qb, kind, refId);
    const exists = await qb.getOne();
    if (!exists) throw new NotFoundException('EVENT_NOT_FOUND');
  }

  /**
   * Restricts a query to events the portal caller (student/parent/teacher) is
   * related to — explicit invitee OR class enrollment (evt_cls_id). PLN-260714/715.
   */
  private applyPortalScope(
    qb: import('typeorm').SelectQueryBuilder<CalEventTypeormEntity>,
    kind: 'STUDENT' | 'PARENT' | 'TEACHER',
    refId: string,
  ): void {
    if (kind === 'STUDENT') {
      qb.andWhere(
        `(EXISTS (SELECT 1 FROM amb_acm_cal_invitee i
                  WHERE i.evt_id = e.evt_id AND i.ent_id = e.ent_id
                    AND i.inv_kind = 'STUDENT' AND i.inv_ref_id = :ref)
          OR (e.evt_cls_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM amb_acm_cls_class_students cs
                 WHERE cs.cls_id = e.evt_cls_id AND cs.ent_id = e.ent_id
                   AND cs.cst_student_user_id = :ref AND cs.cst_left_at IS NULL)))`,
        { ref: refId },
      );
    } else if (kind === 'TEACHER') {
      qb.andWhere(
        `(e.evt_assignee_tch_id = :ref OR EXISTS (
            SELECT 1 FROM amb_acm_cal_invitee i
            WHERE i.evt_id = e.evt_id AND i.ent_id = e.ent_id
              AND i.inv_kind = 'TEACHER' AND i.inv_ref_id = :ref))`,
        { ref: refId },
      );
    } else {
      qb.andWhere(
        `(EXISTS (SELECT 1 FROM amb_acm_cal_invitee i
                  JOIN amb_acm_std_student_parent sp
                    ON sp.std_id = i.inv_ref_id AND sp.ent_id = i.ent_id
                  WHERE i.evt_id = e.evt_id AND i.ent_id = e.ent_id
                    AND i.inv_kind = 'STUDENT' AND sp.par_id = :ref)
          OR (e.evt_cls_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM amb_acm_cls_class_students cs
                  JOIN amb_acm_std_student_parent sp
                    ON sp.std_id = cs.cst_student_user_id AND sp.ent_id = cs.ent_id
                 WHERE cs.cls_id = e.evt_cls_id AND cs.ent_id = e.ent_id
                   AND cs.cst_left_at IS NULL AND sp.par_id = :ref)))`,
        { ref: refId },
      );
    }
  }

  /** Shared enrichment — owner/assignee names, invitee counts, primary student. */
  private async enrichItems(entId: string, items: CalEventTypeormEntity[]) {
    const ownerMap = await this.lookupOwners(entId, [
      ...items.map((i) => i.ownerUserId),
      // REQ-260728 — 삭제자 이름도 같은 조회로 resolve('삭제 보기').
      ...items.map((i) => i.deletedBy ?? ''),
    ]);
    const assigneeMap = await this.lookupAssignees(
      entId,
      items.map((i) => i.assigneeTchId),
    );
    const counts = await this.inviteeSvc.countsByEvent(
      entId,
      items.map((i) => i.id),
    );
    const primaryStudents = await this.inviteeSvc.primaryStudentNamesByEvent(
      entId,
      items.map((i) => i.id),
    );

    return items.map((e) => ({
      ...this.toDetail(e),
      ownerName: ownerMap.get(e.ownerUserId)?.name ?? null,
      ownerEmail: ownerMap.get(e.ownerUserId)?.email ?? null,
      assigneeName: e.assigneeTchId
        ? (assigneeMap.get(e.assigneeTchId)?.name ?? null)
        : null,
      assigneeEmail: e.assigneeTchId
        ? (assigneeMap.get(e.assigneeTchId)?.email ?? null)
        : null,
      inviteeCount: counts.get(e.id) ?? 0,
      primaryStudentName:
        primaryStudents.get(e.id) ??
        this.extractStudentNameFromTitle(e.title) ??
        null,
      deletedByName: e.deletedBy
        ? (ownerMap.get(e.deletedBy)?.name ?? null)
        : null,
    }));
  }

  async findOne(
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
    id: string,
  ) {
    const e = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!e) throw new NotFoundException('EVENT_NOT_FOUND');
    this.assertCanView(e, actorUserId, actorRole);

    const ownerMap = await this.lookupOwners(entId, [e.ownerUserId]);
    const assigneeMap = await this.lookupAssignees(entId, [e.assigneeTchId]);
    const invitees = await this.inviteeSvc.listForEvent(entId, e.id);
    const cslLink = await this.lookupCslLink(entId, e.id);
    const attachments = await this.eventAttachmentSvc.list(entId, e.id);

    return {
      ...this.toDetail(e),
      ownerName: ownerMap.get(e.ownerUserId)?.name ?? null,
      ownerEmail: ownerMap.get(e.ownerUserId)?.email ?? null,
      assigneeName: e.assigneeTchId
        ? (assigneeMap.get(e.assigneeTchId)?.name ?? null)
        : null,
      assigneeEmail: e.assigneeTchId
        ? (assigneeMap.get(e.assigneeTchId)?.email ?? null)
        : null,
      invitees,
      primaryStudentName:
        invitees.find((invitee) => invitee.kind === 'STUDENT')?.name ??
        this.extractStudentNameFromTitle(e.title) ??
        null,
      cslLink,
      attachments,
    };
  }

  async create(
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
    dto: CreateCalEventDto,
  ) {
    this.validateTimes(dto.evtStartAt, dto.evtEndAt);
    // REQ-260526 v2 FR-ROOM-4 — BODASCHOOL 의 URL 은 이벤트 저장 후 자동
    // 생성되므로 사용자 입력을 강제하지 않는다. 그 외 provider 는 기존 로직.
    if (dto.evtMeetingProvider !== 'BODASCHOOL') {
      this.validateMeeting(dto.evtMeetingProvider, dto.evtMeetingUrl);
    }

    let ownerUserId = actorUserId;
    if (dto.evtOwnerUserId && dto.evtOwnerUserId !== actorUserId) {
      if (actorRole !== 'ADMIN') {
        throw new ForbiddenException('CANNOT_ASSIGN_OWNER');
      }
      ownerUserId = dto.evtOwnerUserId;
    }

    const entity = this.repo.create({
      entId,
      ownerUserId,
      category: dto.evtCategory ?? 'CLASS',
      title: dto.evtTitle,
      description: dto.evtDescription ?? null,
      startAt: new Date(dto.evtStartAt),
      endAt: new Date(dto.evtEndAt),
      allDay: dto.evtAllDay ?? false,
      locationText: dto.evtLocationText ?? null,
      meetingProvider: dto.evtMeetingProvider ?? 'NONE',
      meetingUrl: dto.evtMeetingUrl ?? null,
      bodaRoomType: dto.evtBodaRoomType ?? 'ONE_TO_ONE',
      clsId: dto.evtClsId ?? null,
      assigneeTchId: dto.evtAssigneeTchId ?? null,
      source: 'MANUAL',
    });
    const saved = await this.repo.save(entity);

    await this.ensureBodaLauncher(entId, saved);

    let notifySummary: NotifySummary | null = null;
    if (dto.evtInvitees && dto.evtInvitees.length > 0) {
      await this.inviteeSvc.assertSameTenant(entId, dto.evtInvitees);
      const diff = await this.inviteeSvc.diff(entId, saved.id, dto.evtInvitees);
      const added = await this.inviteeSvc.applyDiff(diff);
      notifySummary = await this.notifier.notifyAdded(entId, saved, added);
    }

    const ownerMap = await this.lookupOwners(entId, [saved.ownerUserId]);
    const assigneeMap = await this.lookupAssignees(entId, [
      saved.assigneeTchId,
    ]);
    const invitees = await this.inviteeSvc.listForEvent(entId, saved.id);
    return {
      ...this.toDetail(saved),
      ownerName: ownerMap.get(saved.ownerUserId)?.name ?? null,
      ownerEmail: ownerMap.get(saved.ownerUserId)?.email ?? null,
      assigneeName: saved.assigneeTchId
        ? (assigneeMap.get(saved.assigneeTchId)?.name ?? null)
        : null,
      assigneeEmail: saved.assigneeTchId
        ? (assigneeMap.get(saved.assigneeTchId)?.email ?? null)
        : null,
      invitees,
      notifySummary,
    };
  }

  async update(
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
    id: string,
    dto: UpdateCalEventDto,
  ) {
    const e = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!e) throw new NotFoundException('EVENT_NOT_FOUND');
    this.assertCanMutate(e, actorUserId, actorRole);

    // REQ-260728 — 변경 diff 계산용 이전 스냅샷.
    const beforeSnapshot = this.snapshotForRevision(e);

    if (dto.evtCategory !== undefined) e.category = dto.evtCategory;
    if (dto.evtTitle !== undefined) e.title = dto.evtTitle;
    if (dto.evtDescription !== undefined) e.description = dto.evtDescription;
    if (dto.evtStartAt !== undefined) e.startAt = new Date(dto.evtStartAt);
    if (dto.evtEndAt !== undefined) e.endAt = new Date(dto.evtEndAt);
    if (dto.evtAllDay !== undefined) e.allDay = dto.evtAllDay;
    if (dto.evtLocationText !== undefined) e.locationText = dto.evtLocationText;
    const prevMeetingProvider = e.meetingProvider;
    if (dto.evtMeetingProvider !== undefined)
      e.meetingProvider = dto.evtMeetingProvider;
    if (dto.evtMeetingUrl !== undefined) e.meetingUrl = dto.evtMeetingUrl;
    const prevBodaRoomType = e.bodaRoomType;
    if (dto.evtBodaRoomType !== undefined) e.bodaRoomType = dto.evtBodaRoomType;
    if (dto.evtClsId !== undefined) e.clsId = dto.evtClsId;
    if (dto.evtAssigneeTchId !== undefined)
      e.assigneeTchId = dto.evtAssigneeTchId;

    if (e.endAt <= e.startAt) throw new BadRequestException('END_BEFORE_START');
    if (e.meetingProvider !== 'BODASCHOOL') {
      this.validateMeeting(e.meetingProvider, e.meetingUrl ?? undefined);
    }

    e.updatedAt = new Date();
    const saved = await this.repo.save(e);

    // REQ-260728 — 사용자 수정 히스토리(변경 필드가 있을 때만 1건).
    const changes = this.diffRevision(
      beforeSnapshot,
      this.snapshotForRevision(saved),
    );
    if (changes.length > 0) {
      await this.revisionRepo.save(
        this.revisionRepo.create({
          entId,
          evtId: saved.id,
          editorUserId: actorUserId,
          reason: dto.evtEditReason,
          changes,
        }),
      );
    }

    if (saved.meetingProvider === 'BODASCHOOL') {
      const shouldProvision =
        !saved.meetingUrl || prevMeetingProvider !== 'BODASCHOOL';
      if (shouldProvision) {
        await this.ensureBodaLauncher(entId, saved);
      } else if (saved.bodaRoomType !== prevBodaRoomType) {
        // 룸 유형 토글(1:1↔1:N) — 아직 개설 전(PENDING)이면 roomCode 교체.
        await this.bodaRoomSvc.applyRoomTypeIfPending(
          saved.id,
          entId,
          saved.bodaRoomType,
        );
      }
    }

    let notifySummary: NotifySummary | null = null;
    if (dto.evtInvitees !== undefined) {
      await this.inviteeSvc.assertSameTenant(entId, dto.evtInvitees);
      const diff = await this.inviteeSvc.diff(entId, saved.id, dto.evtInvitees);
      const added = await this.inviteeSvc.applyDiff(diff);
      notifySummary = await this.notifier.notifyAdded(entId, saved, added);
    }

    const ownerMap = await this.lookupOwners(entId, [saved.ownerUserId]);
    const assigneeMap = await this.lookupAssignees(entId, [
      saved.assigneeTchId,
    ]);
    const invitees = await this.inviteeSvc.listForEvent(entId, saved.id);
    return {
      ...this.toDetail(saved),
      ownerName: ownerMap.get(saved.ownerUserId)?.name ?? null,
      ownerEmail: ownerMap.get(saved.ownerUserId)?.email ?? null,
      assigneeName: saved.assigneeTchId
        ? (assigneeMap.get(saved.assigneeTchId)?.name ?? null)
        : null,
      assigneeEmail: saved.assigneeTchId
        ? (assigneeMap.get(saved.assigneeTchId)?.email ?? null)
        : null,
      invitees,
      notifySummary,
    };
  }

  async remove(
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
    id: string,
    reason: string,
  ) {
    const e = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!e) throw new NotFoundException('EVENT_NOT_FOUND');
    this.assertCanMutate(e, actorUserId, actorRole);
    // REQ-260526 v2 FR-ROOM-7 — BODASCHOOL 이벤트면 SERVER API /close 호출
    // 후 boda_room 행 CASCADE 삭제. SERVER API 실패는 deletion 을 막지 않음.
    if (e.meetingProvider === 'BODASCHOOL') {
      await this.bodaRoomSvc.closeAndDelete(e.id, entId);
    }
    // REQ-260728 — soft-delete + 삭제 사유·삭제자 기록.
    e.deletedAt = new Date();
    e.deleteReason = reason;
    e.deletedBy = actorUserId;
    e.updatedAt = new Date();
    await this.repo.save(e);
    return { id };
  }

  /**
   * REQ-260728 — 이벤트 수정 히스토리(시간역순). 수정자 이름 resolve.
   */
  async getRevisions(
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
    id: string,
  ) {
    const e = await this.repo.findOne({ where: { id, entId } });
    if (!e) throw new NotFoundException('EVENT_NOT_FOUND');
    this.assertCanView(e, actorUserId, actorRole);
    const rows = await this.revisionRepo.find({
      where: { entId, evtId: id },
      order: { createdAt: 'DESC' },
    });
    const editorMap = await this.lookupOwners(
      entId,
      rows.map((r) => r.editorUserId ?? ''),
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        editorUserId: r.editorUserId ?? null,
        editorName: r.editorUserId
          ? (editorMap.get(r.editorUserId)?.name ?? null)
          : null,
        reason: r.reason ?? null,
        changes: r.changes ?? [],
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /** REQ-260728 — 수정 diff 대상 필드의 스냅샷(문자열 정규화). */
  private snapshotForRevision(
    e: CalEventTypeormEntity,
  ): Record<string, string | null> {
    return {
      category: e.category ?? null,
      title: e.title ?? null,
      description: e.description ?? null,
      startAt: e.startAt ? e.startAt.toISOString() : null,
      endAt: e.endAt ? e.endAt.toISOString() : null,
      allDay: e.allDay ? 'true' : 'false',
      locationText: e.locationText ?? null,
      meetingProvider: e.meetingProvider ?? null,
      bodaRoomType: e.bodaRoomType ?? null,
      assigneeTchId: e.assigneeTchId ?? null,
    };
  }

  private diffRevision(
    before: Record<string, string | null>,
    after: Record<string, string | null>,
  ): CalEventChange[] {
    const out: CalEventChange[] = [];
    for (const field of Object.keys(after)) {
      if ((before[field] ?? null) !== (after[field] ?? null)) {
        out.push({
          field,
          before: before[field] ?? null,
          after: after[field] ?? null,
        });
      }
    }
    return out;
  }

  private async lookupOwners(
    entId: string,
    ids: string[],
  ): Promise<Map<string, { name: string; email: string }>> {
    const map = new Map<string, { name: string; email: string }>();
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return map;
    const rows = await this.userRepo.find({
      where: { id: In(unique), entId },
      select: ['id', 'name', 'email'],
    });
    for (const r of rows) map.set(r.id, { name: r.name, email: r.email });
    return map;
  }

  /**
   * REQ-260630 — resolve teacher names/emails for the assignee column.
   * Soft-deleted teachers (`deleted_at IS NOT NULL`) still resolve so a
   * historical event's display doesn't go blank.
   */
  private async lookupAssignees(
    entId: string,
    ids: (string | null | undefined)[],
  ): Promise<Map<string, { name: string; email: string }>> {
    const map = new Map<string, { name: string; email: string }>();
    const unique = Array.from(
      new Set(
        ids.filter((x): x is string => typeof x === 'string' && x.length > 0),
      ),
    );
    if (unique.length === 0) return map;
    const rows = await this.tchRepo.find({
      where: { id: In(unique), entId },
      select: ['id', 'name', 'email'],
    });
    for (const r of rows) map.set(r.id, { name: r.name, email: r.email });
    return map;
  }

  private validateTimes(start: string, end: string) {
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      throw new BadRequestException('INVALID_DATE');
    }
    if (e <= s) throw new BadRequestException('END_BEFORE_START');
  }

  private validateMeeting(provider?: string, url?: string | null) {
    if (provider && provider !== 'NONE') {
      if (!url || !/^https?:\/\//i.test(url)) {
        throw new BadRequestException('MEETING_URL_REQUIRED');
      }
    }
  }

  private async ensureBodaLauncher(
    entId: string,
    event: CalEventTypeormEntity,
  ): Promise<void> {
    if (event.meetingProvider !== 'BODASCHOOL') return;
    const { launcherUrl } = await this.bodaRoomSvc.createPending({
      evtId: event.id,
      entId,
      sesId: null,
      roomType: event.bodaRoomType,
    });
    event.meetingUrl = launcherUrl;
    await this.repo.update({ id: event.id }, { meetingUrl: launcherUrl });
  }

  private async lookupCslLink(
    entId: string,
    evtId: string,
  ): Promise<CslEventLinkSummary | null> {
    const demo = await this.trialClassRepo.findOne({
      where: { entId, calEventId: evtId },
    });
    if (demo) {
      const attachments = await this.attachmentRepo
        .createQueryBuilder('a')
        .where('a.entId = :entId', { entId })
        .andWhere('a.inqId = :inqId', { inqId: demo.inqId })
        .andWhere('a.category = :category', { category: 'MATERIAL' })
        .andWhere('a.refId = :refId', { refId: demo.id })
        .andWhere('a.deletedAt IS NULL')
        .andWhere('a.uploadedBy IS NOT NULL')
        .orderBy('a.createdAt', 'DESC')
        .getMany();
      return {
        kind: 'DEMO_CLASS',
        inqId: demo.inqId,
        refId: demo.id,
        feedbackBody: demo.feedbackBody ?? null,
        attachments: attachments.map((row) => ({
          id: row.id,
          refId: row.refId ?? null,
          filename: row.filename,
          mime: row.mime,
          sizeBytes: row.sizeBytes,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    }

    const levelTest = await this.mapTestRepo.findOne({
      where: { entId, calEventId: evtId },
    });
    if (!levelTest) return null;
    return {
      kind: 'LEVEL_TEST',
      inqId: levelTest.inqId,
      refId: levelTest.id,
      attachments: [],
    };
  }

  private extractStudentNameFromTitle(title: string): string | null {
    const demo = /^Demo Class\s+[-—]\s+(.+)$/i.exec(title);
    if (demo?.[1]) return demo[1].trim();
    const level = /^Level Test(?:\s+\(.+\))?\s+[-—]\s+(.+)$/i.exec(title);
    if (level?.[1]) return level[1].trim();
    return null;
  }

  private assertCanView(
    e: CalEventTypeormEntity,
    actorUserId: string,
    role: AcmRole,
  ) {
    if (role === 'ADMIN') return;
    if (e.ownerUserId !== actorUserId)
      throw new ForbiddenException('NOT_OWNER');
  }

  private assertCanMutate(
    e: CalEventTypeormEntity,
    actorUserId: string,
    role: AcmRole,
  ) {
    if (role === 'ADMIN') return;
    if (e.ownerUserId !== actorUserId)
      throw new ForbiddenException('NOT_OWNER');
    if (e.source !== 'MANUAL') throw new ForbiddenException('READ_ONLY_SOURCE');
  }

  private toDetail = (e: CalEventTypeormEntity) => ({
    id: e.id,
    entId: e.entId,
    ownerUserId: e.ownerUserId,
    category: e.category,
    title: e.title,
    description: e.description,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    allDay: e.allDay,
    locationText: e.locationText,
    meetingProvider: e.meetingProvider,
    meetingUrl: e.meetingUrl,
    bodaRoomType: e.bodaRoomType,
    clsId: e.clsId,
    assigneeTchId: e.assigneeTchId ?? null,
    source: e.source,
    // REQ-260728 — 삭제 메타(삭제 보기 목록에서 사용).
    deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
    deleteReason: e.deleteReason ?? null,
    deletedBy: e.deletedBy ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  });
}
