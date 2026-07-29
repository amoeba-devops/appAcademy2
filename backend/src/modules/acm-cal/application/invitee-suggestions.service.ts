import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmRole } from '../../acm-common/decorators/current-user.decorator';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { ClassTypeormEntity } from '../../acm-cls/infrastructure/typeorm/class.typeorm-entity';
import { ClassStudentTypeormEntity } from '../../acm-cls/infrastructure/typeorm/class-student.typeorm-entity';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import { CalInviteeTypeormEntity } from '../infrastructure/typeorm/cal-invitee.typeorm-entity';

export interface InviteeSuggestion {
  kind: 'STUDENT';
  refId: string;
  name: string;
  /** Sub-label shown under the name in the picker — class name or "최근". */
  subLabel: string | null;
  /** Why this student is on the list — drives the UI chip color. */
  reason: 'CLASS' | 'RECENT';
}

/**
 * REQ-260610 FR-INSTANT-3 — 즉시 강의 모달의 추천 학생 12명.
 *
 * 두 가지 소스를 합집합:
 *   1. **본 강사 담당 클래스의 학생** (`cls_classes.cls_teacher_user_id = me`,
 *      cls_status IN ['ACTIVE','PROPOSED']) — reason='CLASS'.
 *   2. **최근 7일 본 강사 caleventowner 의 invitee 학생** (출현 빈도 desc) —
 *      reason='RECENT'.
 *
 * 두 집합이 겹치면 reason='CLASS' 우선 (사용자 관점에서 더 신호가 강함).
 * limit 으로 잘라서 반환.
 *
 * ADMIN 역할로 호출된 경우 — 본인 actor 가 담당이 아니어도 전 클래스의
 * 최근 invitee 12명을 반환 (admin 이 임시로 즉시강의 열 때 유용).
 */
@Injectable()
export class InviteeSuggestionsService {
  private readonly logger = new Logger(InviteeSuggestionsService.name);

  constructor(
    @InjectRepository(StudentTypeormEntity, ACM_DS)
    private readonly stdRepo: Repository<StudentTypeormEntity>,
    @InjectRepository(ClassTypeormEntity, ACM_DS)
    private readonly clsRepo: Repository<ClassTypeormEntity>,
    @InjectRepository(ClassStudentTypeormEntity, ACM_DS)
    private readonly cstRepo: Repository<ClassStudentTypeormEntity>,
    @InjectRepository(CalEventTypeormEntity, ACM_DS)
    private readonly evtRepo: Repository<CalEventTypeormEntity>,
    @InjectRepository(CalInviteeTypeormEntity, ACM_DS)
    private readonly invRepo: Repository<CalInviteeTypeormEntity>,
  ) {}

  async suggest(params: {
    entId: string;
    actorUserId: string;
    actorRole: AcmRole;
    limit?: number;
  }): Promise<InviteeSuggestion[]> {
    const limit = Math.min(Math.max(params.limit ?? 12, 1), 50);

    const [classMembers, recentInvitees] = await Promise.all([
      this.classMembers(params.entId, params.actorUserId, params.actorRole),
      this.recentInvitees(params.entId, params.actorUserId, params.actorRole),
    ]);

    // Merge — CLASS reason wins on collision.
    const byRefId = new Map<string, InviteeSuggestion>();
    for (const c of classMembers) byRefId.set(c.refId, c);
    for (const r of recentInvitees) {
      if (!byRefId.has(r.refId)) byRefId.set(r.refId, r);
    }

    return Array.from(byRefId.values()).slice(0, limit);
  }

  // -----------------------------------------------------------------
  // Source 1 — classes the actor teaches
  // -----------------------------------------------------------------
  private async classMembers(
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
  ): Promise<InviteeSuggestion[]> {
    const clsQb = this.clsRepo
      .createQueryBuilder('c')
      .select(['c.id', 'c.code', 'c.subjectLabel'])
      .where('c.entId = :entId', { entId })
      .andWhere("c.status IN ('ACTIVE', 'PROPOSED')");

    if (actorRole !== 'ADMIN') {
      clsQb.andWhere('c.teacherUserId = :uid', { uid: actorUserId });
    }
    const classes = await clsQb.getMany();
    if (classes.length === 0) return [];

    const classIds = classes.map((c) => c.id);
    const classNameById = new Map(
      classes.map((c) => [c.id, c.subjectLabel ?? c.code]),
    );

    const memberships = await this.cstRepo.find({
      where: classIds.map((cid) => ({ entId, clsId: cid })),
      select: ['clsId', 'studentUserId'],
    });
    if (memberships.length === 0) return [];

    const studentIds = Array.from(
      new Set(memberships.map((m) => m.studentUserId)),
    );
    const students = await this.stdRepo.find({
      where: studentIds.map((sid) => ({ entId, id: sid })),
      select: ['id', 'name'],
    });
    const nameById = new Map(students.map((s) => [s.id, s.name]));

    // Pick the first class label per student for the sub-label.
    const firstClassByStudent = new Map<string, string>();
    for (const m of memberships) {
      if (!firstClassByStudent.has(m.studentUserId)) {
        firstClassByStudent.set(
          m.studentUserId,
          classNameById.get(m.clsId) ?? '',
        );
      }
    }

    return studentIds
      .filter((sid) => nameById.has(sid))
      .map<InviteeSuggestion>((sid) => ({
        kind: 'STUDENT',
        refId: sid,
        name: nameById.get(sid)!,
        subLabel: firstClassByStudent.get(sid) || null,
        reason: 'CLASS',
      }));
  }

  // -----------------------------------------------------------------
  // Source 2 — recent (7d) invitees of the actor's events
  // -----------------------------------------------------------------
  private async recentInvitees(
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
  ): Promise<InviteeSuggestion[]> {
    const since = new Date(Date.now() - 7 * 86_400_000);

    const evtQb = this.evtRepo
      .createQueryBuilder('e')
      .select(['e.id'])
      .where('e.entId = :entId', { entId })
      .andWhere('e.startAt >= :since', { since });

    if (actorRole !== 'ADMIN') {
      evtQb.andWhere('e.ownerUserId = :uid', { uid: actorUserId });
    }
    const events = await evtQb.getMany();
    if (events.length === 0) return [];

    const eventIds = events.map((e) => e.id);
    const invitees = await this.invRepo
      .createQueryBuilder('i')
      .select(['i.refId', 'i.kind'])
      .where('i.entId = :entId', { entId })
      .andWhere("i.kind = 'STUDENT'")
      .andWhere('i.evtId IN (:...evtIds)', { evtIds: eventIds })
      .getMany();

    // Frequency count
    const freq = new Map<string, number>();
    for (const inv of invitees) {
      freq.set(inv.refId, (freq.get(inv.refId) ?? 0) + 1);
    }
    const sortedRefIds = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([refId]) => refId);
    if (sortedRefIds.length === 0) return [];

    const students = await this.stdRepo.find({
      where: sortedRefIds.map((sid) => ({ entId, id: sid })),
      select: ['id', 'name'],
    });
    const nameById = new Map(students.map((s) => [s.id, s.name]));

    return sortedRefIds
      .filter((sid) => nameById.has(sid))
      .map<InviteeSuggestion>((sid) => ({
        kind: 'STUDENT',
        refId: sid,
        name: nameById.get(sid)!,
        subLabel: '최근',
        reason: 'RECENT',
      }));
  }
}
