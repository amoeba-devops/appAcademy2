import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmRole } from '../../acm-common/decorators/current-user.decorator';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import type {
  CreateCalEventDto,
  ListCalEventsQueryDto,
  UpdateCalEventDto,
} from './dto/cal-event.dto';

@Injectable()
export class CalEventService {
  constructor(
    @InjectRepository(CalEventTypeormEntity, ACM_DS)
    private readonly repo: Repository<CalEventTypeormEntity>,
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
      // overlap: event_start < to AND event_end > from
      .andWhere('e.startAt < :to', { to })
      .andWhere('e.endAt > :from', { from });

    if (q.category) qb.andWhere('e.category = :category', { category: q.category });

    // Visibility:
    // - ADMIN: can see all (optionally filter by ownerUserId)
    // - TEACHER/STAFF: only own events
    if (actorRole === 'ADMIN') {
      if (q.ownerUserId) qb.andWhere('e.ownerUserId = :owner', { owner: q.ownerUserId });
    } else {
      qb.andWhere('e.ownerUserId = :owner', { owner: actorUserId });
    }

    qb.orderBy('e.startAt', 'ASC');
    const items = await qb.getMany();
    return { items: items.map(this.toDetail) };
  }

  async findOne(entId: string, actorUserId: string, actorRole: AcmRole, id: string) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('EVENT_NOT_FOUND');
    this.assertCanView(e, actorUserId, actorRole);
    return this.toDetail(e);
  }

  async create(
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
    dto: CreateCalEventDto,
  ) {
    this.validateTimes(dto.evtStartAt, dto.evtEndAt);
    this.validateMeeting(dto.evtMeetingProvider, dto.evtMeetingUrl);

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
    return this.toDetail(saved);
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
    return this.toDetail(saved);
  }

  async remove(entId: string, actorUserId: string, actorRole: AcmRole, id: string) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('EVENT_NOT_FOUND');
    this.assertCanMutate(e, actorUserId, actorRole);
    e.deletedAt = new Date();
    e.updatedAt = new Date();
    await this.repo.save(e);
    return { id };
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
