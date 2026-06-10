import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmRole } from '../../acm-common/decorators/current-user.decorator';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import { CalInviteeService } from './cal-invitee.service';
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

@Injectable()
export class CalEventService {
  constructor(
    @InjectRepository(CalEventTypeormEntity, ACM_DS)
    private readonly repo: Repository<CalEventTypeormEntity>,
    @InjectRepository(AcmUserTypeormEntity, ACM_DS)
    private readonly userRepo: Repository<AcmUserTypeormEntity>,
    private readonly inviteeSvc: CalInviteeService,
    private readonly notifier: InviteeNotifierService,
    private readonly bodaRoomSvc: BodaRoomService,
  ) {}

  async list(
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
    q: ListCalEventsQueryDto,
  ) {
    const from = new Date(q.from);
    const to = new Date(q.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new BadRequestException('INVALID_RANGE');
    }

    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.entId = :entId', { entId })
      .andWhere('e.deletedAt IS NULL')
      .andWhere('e.startAt < :to', { to })
      .andWhere('e.endAt > :from', { from });

    if (q.category) qb.andWhere('e.category = :category', { category: q.category });

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

    const ownerMap = await this.lookupOwners(entId, items.map((i) => i.ownerUserId));
    const counts = await this.inviteeSvc.countsByEvent(entId, items.map((i) => i.id));

    return {
      items: items.map((e) => ({
        ...this.toDetail(e),
        ownerName: ownerMap.get(e.ownerUserId)?.name ?? null,
        ownerEmail: ownerMap.get(e.ownerUserId)?.email ?? null,
        inviteeCount: counts.get(e.id) ?? 0,
      })),
    };
  }

  async findOne(entId: string, actorUserId: string, actorRole: AcmRole, id: string) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('EVENT_NOT_FOUND');
    this.assertCanView(e, actorUserId, actorRole);

    const ownerMap = await this.lookupOwners(entId, [e.ownerUserId]);
    const invitees = await this.inviteeSvc.listForEvent(entId, e.id);

    return {
      ...this.toDetail(e),
      ownerName: ownerMap.get(e.ownerUserId)?.name ?? null,
      ownerEmail: ownerMap.get(e.ownerUserId)?.email ?? null,
      invitees,
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
      clsId: dto.evtClsId ?? null,
      source: 'MANUAL',
    });
    const saved = await this.repo.save(entity);

    // REQ-260526 v2 FR-ROOM-1/2/4 — BODASCHOOL 이면 룸 PENDING 생성 후
    // 런처 URL 을 다시 evt_meeting_url 에 채워서 저장한다. update 는 별도
    // round-trip 으로 처리 (save() 가 returning row 를 주지 않을 수 있음).
    if (saved.meetingProvider === 'BODASCHOOL') {
      const { launcherUrl } = await this.bodaRoomSvc.createPending({
        evtId: saved.id,
        entId,
        sesId: null,
      });
      saved.meetingUrl = launcherUrl;
      await this.repo.update({ id: saved.id }, { meetingUrl: launcherUrl });
    }

    let notifySummary: NotifySummary | null = null;
    if (dto.evtInvitees && dto.evtInvitees.length > 0) {
      await this.inviteeSvc.assertSameTenant(entId, dto.evtInvitees);
      const diff = await this.inviteeSvc.diff(entId, saved.id, dto.evtInvitees);
      const added = await this.inviteeSvc.applyDiff(diff);
      notifySummary = await this.notifier.notifyAdded(entId, saved, added);
    }

    const ownerMap = await this.lookupOwners(entId, [saved.ownerUserId]);
    const invitees = await this.inviteeSvc.listForEvent(entId, saved.id);
    return {
      ...this.toDetail(saved),
      ownerName: ownerMap.get(saved.ownerUserId)?.name ?? null,
      ownerEmail: ownerMap.get(saved.ownerUserId)?.email ?? null,
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
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('EVENT_NOT_FOUND');
    this.assertCanMutate(e, actorUserId, actorRole);

    if (dto.evtCategory !== undefined) e.category = dto.evtCategory;
    if (dto.evtTitle !== undefined) e.title = dto.evtTitle;
    if (dto.evtDescription !== undefined) e.description = dto.evtDescription;
    if (dto.evtStartAt !== undefined) e.startAt = new Date(dto.evtStartAt);
    if (dto.evtEndAt !== undefined) e.endAt = new Date(dto.evtEndAt);
    if (dto.evtAllDay !== undefined) e.allDay = dto.evtAllDay;
    if (dto.evtLocationText !== undefined) e.locationText = dto.evtLocationText;
    if (dto.evtMeetingProvider !== undefined) e.meetingProvider = dto.evtMeetingProvider;
    if (dto.evtMeetingUrl !== undefined) e.meetingUrl = dto.evtMeetingUrl;
    if (dto.evtClsId !== undefined) e.clsId = dto.evtClsId;

    if (e.endAt <= e.startAt) throw new BadRequestException('END_BEFORE_START');
    this.validateMeeting(e.meetingProvider, e.meetingUrl ?? undefined);

    e.updatedAt = new Date();
    const saved = await this.repo.save(e);

    let notifySummary: NotifySummary | null = null;
    if (dto.evtInvitees !== undefined) {
      await this.inviteeSvc.assertSameTenant(entId, dto.evtInvitees);
      const diff = await this.inviteeSvc.diff(entId, saved.id, dto.evtInvitees);
      const added = await this.inviteeSvc.applyDiff(diff);
      notifySummary = await this.notifier.notifyAdded(entId, saved, added);
    }

    const ownerMap = await this.lookupOwners(entId, [saved.ownerUserId]);
    const invitees = await this.inviteeSvc.listForEvent(entId, saved.id);
    return {
      ...this.toDetail(saved),
      ownerName: ownerMap.get(saved.ownerUserId)?.name ?? null,
      ownerEmail: ownerMap.get(saved.ownerUserId)?.email ?? null,
      invitees,
      notifySummary,
    };
  }

  async remove(entId: string, actorUserId: string, actorRole: AcmRole, id: string) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('EVENT_NOT_FOUND');
    this.assertCanMutate(e, actorUserId, actorRole);
    // REQ-260526 v2 FR-ROOM-7 — BODASCHOOL 이벤트면 SERVER API /close 호출
    // 후 boda_room 행 CASCADE 삭제. SERVER API 실패는 deletion 을 막지 않음.
    if (e.meetingProvider === 'BODASCHOOL') {
      await this.bodaRoomSvc.closeAndDelete(e.id, entId);
    }
    e.deletedAt = new Date();
    e.updatedAt = new Date();
    await this.repo.save(e);
    return { id };
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

  private assertCanView(e: CalEventTypeormEntity, actorUserId: string, role: AcmRole) {
    if (role === 'ADMIN') return;
    if (e.ownerUserId !== actorUserId) throw new ForbiddenException('NOT_OWNER');
  }

  private assertCanMutate(e: CalEventTypeormEntity, actorUserId: string, role: AcmRole) {
    if (role === 'ADMIN') return;
    if (e.ownerUserId !== actorUserId) throw new ForbiddenException('NOT_OWNER');
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
    clsId: e.clsId,
    source: e.source,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  });
}
