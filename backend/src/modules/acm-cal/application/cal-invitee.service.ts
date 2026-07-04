import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { TeacherTypeormEntity } from '../../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import {
  CalInviteeKind,
  CalInviteeTypeormEntity,
} from '../infrastructure/typeorm/cal-invitee.typeorm-entity';
import type { CalInviteeInputDto } from './dto/cal-event.dto';

export interface InviteeView {
  id: string;
  kind: CalInviteeKind;
  refId: string;
  name: string;
  email: string | null;
  notifyStatus: string | null;
  notifiedAt: Date | null;
  notifyError: string | null;
}

export interface InviteeDiff {
  added: CalInviteeTypeormEntity[];
  removedIds: string[];
  kept: CalInviteeTypeormEntity[];
}

const LOG = new Logger('CalInviteeService');

@Injectable()
export class CalInviteeService {
  constructor(
    @InjectRepository(CalInviteeTypeormEntity, ACM_DS)
    private readonly invitees: Repository<CalInviteeTypeormEntity>,
    @InjectRepository(StudentTypeormEntity, ACM_DS)
    private readonly students: Repository<StudentTypeormEntity>,
    @InjectRepository(TeacherTypeormEntity, ACM_DS)
    private readonly teachers: Repository<TeacherTypeormEntity>,
    @InjectRepository(ParentTypeormEntity, ACM_DS)
    private readonly parents: Repository<ParentTypeormEntity>,
  ) {}

  // --------------------------------------------------------------------------
  // Validate cross-tenant: every invitee.refId must belong to the same entId
  // --------------------------------------------------------------------------
  async assertSameTenant(
    entId: string,
    inputs: CalInviteeInputDto[],
  ): Promise<void> {
    if (inputs.length === 0) return;

    const stdIds = inputs.filter((i) => i.kind === 'STUDENT').map((i) => i.refId);
    const tchIds = inputs.filter((i) => i.kind === 'TEACHER').map((i) => i.refId);
    const parIds = inputs.filter((i) => i.kind === 'PARENT').map((i) => i.refId);

    const checks: Promise<unknown>[] = [];
    if (stdIds.length > 0) {
      checks.push(
        this.students
          .createQueryBuilder('s')
          .select('s.std_id', 'id')
          .where('s.std_id IN (:...ids)', { ids: stdIds })
          .andWhere('s.ent_id = :entId', { entId })
          .andWhere('s.deleted_at IS NULL')
          .getRawMany()
          .then((rows) => {
            if (rows.length !== stdIds.length) {
              throw new BadRequestException('INVITEE_TENANT_MISMATCH');
            }
          }),
      );
    }
    if (tchIds.length > 0) {
      checks.push(
        this.teachers
          .createQueryBuilder('t')
          .select('t.tch_id', 'id')
          .where('t.tch_id IN (:...ids)', { ids: tchIds })
          .andWhere('t.ent_id = :entId', { entId })
          .andWhere('t.deleted_at IS NULL')
          .getRawMany()
          .then((rows) => {
            if (rows.length !== tchIds.length) {
              throw new BadRequestException('INVITEE_TENANT_MISMATCH');
            }
          }),
      );
    }
    if (parIds.length > 0) {
      checks.push(
        this.parents
          .createQueryBuilder('p')
          .select('p.par_id', 'id')
          .where('p.par_id IN (:...ids)', { ids: parIds })
          .andWhere('p.ent_id = :entId', { entId })
          .andWhere('p.deleted_at IS NULL')
          .getRawMany()
          .then((rows) => {
            if (rows.length !== parIds.length) {
              throw new BadRequestException('INVITEE_TENANT_MISMATCH');
            }
          }),
      );
    }
    await Promise.all(checks);
  }

  // --------------------------------------------------------------------------
  // Diff existing vs incoming invitees for an event
  // --------------------------------------------------------------------------
  async diff(
    entId: string,
    evtId: string,
    incoming: CalInviteeInputDto[],
  ): Promise<InviteeDiff> {
    const existing = await this.invitees.find({ where: { entId, evtId } });
    const incomingKey = (i: CalInviteeInputDto) => `${i.kind}:${i.refId}`;
    const existingKey = (e: CalInviteeTypeormEntity) => `${e.kind}:${e.refId}`;

    const incomingSet = new Set(incoming.map(incomingKey));
    const existingSet = new Set(existing.map(existingKey));

    const removed = existing.filter((e) => !incomingSet.has(existingKey(e)));
    const kept = existing.filter((e) => incomingSet.has(existingKey(e)));
    const added: CalInviteeTypeormEntity[] = incoming
      .filter((i) => !existingSet.has(incomingKey(i)))
      .map((i) =>
        this.invitees.create({
          entId,
          evtId,
          kind: i.kind,
          refId: i.refId,
        }),
      );

    return { added, removedIds: removed.map((r) => r.id), kept };
  }

  /** Apply diff: insert added, delete removed. Returns saved added rows. */
  async applyDiff(diff: InviteeDiff): Promise<CalInviteeTypeormEntity[]> {
    if (diff.removedIds.length > 0) {
      await this.invitees.delete(diff.removedIds);
    }
    if (diff.added.length === 0) return [];
    return this.invitees.save(diff.added);
  }

  /** Replace status fields after notification attempt. */
  async updateNotifyStatus(
    inviteeId: string,
    status: 'SENT' | 'SKIPPED_NO_EMAIL' | 'SKIPPED_NO_SMTP' | 'FAILED',
    errorText?: string,
  ): Promise<void> {
    await this.invitees.update(inviteeId, {
      notifyStatus: status,
      notifiedAt: status === 'SENT' ? new Date() : null,
      notifyError: errorText ? errorText.slice(0, 200) : null,
    });
  }

  // --------------------------------------------------------------------------
  // Hydrate invitee rows with name + email (batched)
  // --------------------------------------------------------------------------
  async hydrate(
    entId: string,
    rows: CalInviteeTypeormEntity[],
  ): Promise<InviteeView[]> {
    if (rows.length === 0) return [];

    const stdIds = rows.filter((r) => r.kind === 'STUDENT').map((r) => r.refId);
    const tchIds = rows.filter((r) => r.kind === 'TEACHER').map((r) => r.refId);
    const parIds = rows.filter((r) => r.kind === 'PARENT').map((r) => r.refId);

    const [stdMap, tchMap, parMap] = await Promise.all([
      stdIds.length > 0
        ? this.students
            .find({ where: { id: In(stdIds), entId } })
            .then((s) => new Map(s.map((x) => [x.id, { name: x.name, email: x.email ?? null }])))
        : Promise.resolve(new Map<string, { name: string; email: string | null }>()),
      tchIds.length > 0
        ? this.teachers
            .find({ where: { id: In(tchIds), entId } })
            .then((t) => new Map(t.map((x) => [x.id, { name: x.name, email: x.email ?? null }])))
        : Promise.resolve(new Map<string, { name: string; email: string | null }>()),
      parIds.length > 0
        ? this.parents
            .find({ where: { id: In(parIds), entId } })
            .then((p) => new Map(p.map((x) => [x.id, { name: x.name, email: x.email ?? null }])))
        : Promise.resolve(new Map<string, { name: string; email: string | null }>()),
    ]);

    return rows.map((r) => {
      const meta =
        r.kind === 'STUDENT'
          ? stdMap.get(r.refId)
          : r.kind === 'TEACHER'
            ? tchMap.get(r.refId)
            : parMap.get(r.refId);
      return {
        id: r.id,
        kind: r.kind,
        refId: r.refId,
        name: meta?.name ?? '(deleted)',
        email: meta?.email ?? null,
        notifyStatus: r.notifyStatus ?? null,
        notifiedAt: r.notifiedAt ?? null,
        notifyError: r.notifyError ?? null,
      };
    });
  }

  /** Hydrate counts only (for list view). */
  async countsByEvent(
    entId: string,
    evtIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (evtIds.length === 0) return map;
    const rows = await this.invitees
      .createQueryBuilder('i')
      .select('i.evt_id', 'evtId')
      .addSelect('COUNT(*)', 'cnt')
      .where('i.ent_id = :entId', { entId })
      .andWhere('i.evt_id IN (:...evtIds)', { evtIds })
      .groupBy('i.evt_id')
      .getRawMany<{ evtId: string; cnt: string }>();
    for (const r of rows) {
      map.set(r.evtId, Number(r.cnt));
    }
    return map;
  }

  async primaryStudentNamesByEvent(
    entId: string,
    evtIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const unique = Array.from(new Set(evtIds.filter(Boolean)));
    if (unique.length === 0) return map;
    const rows = await this.invitees
      .createQueryBuilder('i')
      .innerJoin(
        StudentTypeormEntity,
        's',
        's.id = i.refId AND s.entId = :entId AND s.deletedAt IS NULL',
        { entId },
      )
      .select('i.evtId', 'evtId')
      .addSelect('s.name', 'name')
      .where('i.entId = :entId', { entId })
      .andWhere('i.kind = :kind', { kind: 'STUDENT' })
      .andWhere('i.evtId IN (:...evtIds)', { evtIds: unique })
      .orderBy('i.createdAt', 'ASC')
      .getRawMany<{ evtId: string; name: string }>();

    for (const row of rows) {
      if (!map.has(row.evtId)) {
        map.set(row.evtId, row.name);
      }
    }
    return map;
  }

  async listForEvent(entId: string, evtId: string): Promise<InviteeView[]> {
    const rows = await this.invitees.find({ where: { entId, evtId } });
    return this.hydrate(entId, rows);
  }

  // --------------------------------------------------------------------------
  // Search candidate invitees (students / teachers / parents) by query string
  // --------------------------------------------------------------------------
  async searchCandidates(
    entId: string,
    q: string | undefined,
    kind: string | undefined,
  ): Promise<
    Array<{
      kind: CalInviteeKind;
      refId: string;
      name: string;
      email: string | null;
      subInfo: string | null;
    }>
  > {
    const wantStudent = !kind || kind === 'ALL' || kind === 'STUDENT';
    const wantTeacher = !kind || kind === 'ALL' || kind === 'TEACHER';
    const wantParent = !kind || kind === 'ALL' || kind === 'PARENT';
    const limit = 30;
    const like = q ? `%${q}%` : null;

    const out: Array<{
      kind: CalInviteeKind;
      refId: string;
      name: string;
      email: string | null;
      subInfo: string | null;
    }> = [];

    if (wantStudent) {
      const qb = this.students
        .createQueryBuilder('s')
        .where('s.entId = :entId', { entId })
        .andWhere('s.deletedAt IS NULL');
      if (like) {
        qb.andWhere(
          '(s.name ILIKE :q OR s.englishName ILIKE :q OR s.school ILIKE :q)',
          { q: like },
        );
      }
      const rows = await qb.orderBy('s.name', 'ASC').take(limit).getMany();
      for (const r of rows) {
        out.push({
          kind: 'STUDENT',
          refId: r.id,
          name: r.name,
          email: r.email ?? null,
          subInfo: [r.school, r.grade].filter(Boolean).join(' / ') || null,
        });
      }
    }

    if (wantTeacher) {
      const qb = this.teachers
        .createQueryBuilder('t')
        .where('t.entId = :entId', { entId })
        .andWhere('t.deletedAt IS NULL');
      if (like) {
        qb.andWhere('(t.name ILIKE :q OR t.englishName ILIKE :q OR t.email ILIKE :q)', {
          q: like,
        });
      }
      const rows = await qb.orderBy('t.name', 'ASC').take(limit).getMany();
      for (const r of rows) {
        out.push({
          kind: 'TEACHER',
          refId: r.id,
          name: r.name,
          email: r.email,
          subInfo: r.email,
        });
      }
    }

    if (wantParent) {
      const qb = this.parents
        .createQueryBuilder('p')
        .where('p.entId = :entId', { entId })
        .andWhere('p.deletedAt IS NULL');
      if (like) {
        qb.andWhere('(p.name ILIKE :q OR p.phone ILIKE :q OR p.email ILIKE :q)', {
          q: like,
        });
      }
      const rows = await qb.orderBy('p.name', 'ASC').take(limit).getMany();
      for (const r of rows) {
        out.push({
          kind: 'PARENT',
          refId: r.id,
          name: r.name,
          email: r.email ?? null,
          subInfo: r.relation ?? null,
        });
      }
    }

    LOG.debug?.(`searchCandidates ent=${entId} kind=${kind ?? 'ALL'} q=${q ?? ''} → ${out.length}`);
    return out;
  }
}
