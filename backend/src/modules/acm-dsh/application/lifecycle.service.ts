import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { validateOpsDate, validateOpsSite } from './operating.service';
import { LifecycleDto } from './dto/lifecycle.dto';
import {
  lifecycleRange,
  LifeEvent,
  LifeStudent,
} from './lifecycle-calculation';
import { kstDaysAgo } from '../business-date';
export interface Subject {
  id: string;
  name: string;
  site: string | null;
  start: string | null;
  person: string;
  description?: string;
}
@Injectable()
export class LifecycleService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly crypto: AesGcmService,
  ) {}
  async subjects(entId: string, kind: string, q = ''): Promise<Subject[]> {
    if (kind === 'STUDENT' || kind === 'PARENT') {
      const student = kind === 'STUDENT';
      return this.ds.query(
        `SELECT ${student ? 'std_id' : 'par_id'}::text id,${student ? 'std_name' : 'par_name'} name,${student ? 'std_site' : 'NULL'} site,${student ? 'std_start_date::text' : 'NULL'} start,${student ? 'std_id' : 'par_id'}::text person,${student ? "concat_ws(' · ',std_school,std_grade,std_birth_date::text)" : 'par_relation'} description FROM ${student ? 'amb_acm_std_student' : 'amb_acm_std_parent'} WHERE ent_id=$1 AND deleted_at IS NULL AND ${student ? 'std_name' : 'par_name'} ILIKE $2 ORDER BY ${student ? 'std_name' : 'par_name'} LIMIT 50`,
        [entId, `%${q.slice(0, 100)}%`],
      );
    }
    if (kind !== 'INQUIRY')
      throw new BadRequestException('Invalid subject kind');
    const rows = await this.ds.query<
      Array<{
        id: string;
        ciphertext: Buffer;
        iv: Buffer;
        authTag: Buffer;
        site: string;
        person: string;
        description: string;
      }>
    >(
      `SELECT inq_id::text id,inq_registered_at::text description,inq_name_encrypted ciphertext,inq_name_iv iv,inq_name_auth_tag "authTag",COALESCE(inq_site_override,inq_source_site,'COMMON') site,COALESCE(inq_std_id,inq_id)::text person FROM amb_acm_csl_inquiry WHERE ent_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [entId],
    );
    return rows
      .map((r) => ({
        id: r.id,
        name: this.crypto.decrypt(r),
        site: r.site,
        person: r.person,
        start: null,
        description: r.description,
      }))
      .filter((r) => r.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()))
      .slice(0, 50);
  }
  async assertSubject(
    m: EntityManager,
    entId: string,
    kind: string,
    id: string,
  ) {
    const table =
      kind === 'STUDENT'
        ? ['amb_acm_std_student', 'std_id']
        : kind === 'PARENT'
          ? ['amb_acm_std_parent', 'par_id']
          : kind === 'INQUIRY'
            ? ['amb_acm_csl_inquiry', 'inq_id']
            : null;
    if (!table) throw new BadRequestException('Invalid subject');
    const rows: unknown[] = await m.query(
      `SELECT 1 FROM ${table[0]} WHERE ent_id=$1 AND ${table[1]}=$2 AND deleted_at IS NULL`,
      [entId, id],
    );
    if (!rows.length) throw new NotFoundException('Subject not found');
  }
  async record(entId: string, actorId: string, dto: LifecycleDto) {
    validateOpsDate(dto.effectiveDate);
    if (dto.effectiveDate > kstDaysAgo(0))
      throw new BadRequestException('Evidence date cannot be in the future');
    return this.ds.transaction(async (m) => {
      await this.assertSubject(m, entId, dto.subjectKind, dto.subjectId);
      if (dto.kind === 'SCHEDULE') {
        if (!dto.status)
          throw new BadRequestException('Schedule status required');
        if (dto.status === 'SCHEDULED') {
          if (!dto.teacherId || !dto.scheduledAt)
            throw new BadRequestException('Teacher and schedule required');
          const teachers: unknown[] = await m.query(
            'SELECT 1 FROM amb_acm_tch_teacher WHERE ent_id=$1 AND tch_id=$2 AND deleted_at IS NULL AND tch_is_instructor',
            [entId, dto.teacherId],
          );
          if (!teachers.length)
            throw new BadRequestException('Invalid teacher');
        }
      }
      if (dto.kind === 'RETURN' || dto.kind === 'REFERRAL') {
        if (!dto.relatedId || !dto.relatedKind || !dto.verified)
          throw new BadRequestException('Verified linked evidence required');
        if (
          dto.kind === 'RETURN' &&
          !['STUDENT', 'INQUIRY'].includes(dto.relatedKind)
        )
          throw new BadRequestException('Prior student or inquiry required');
        if (
          dto.kind === 'REFERRAL' &&
          !['STUDENT', 'PARENT'].includes(dto.relatedKind)
        )
          throw new BadRequestException('Student or parent referrer required');
        await this.assertSubject(m, entId, dto.relatedKind, dto.relatedId);
        if (
          dto.kind === 'REFERRAL' &&
          dto.relatedKind === dto.subjectKind &&
          dto.relatedId === dto.subjectId
        )
          throw new BadRequestException('Self referral is not allowed');
        if (dto.kind === 'RETURN') {
          const current: Array<{ person: string | null }> =
            dto.subjectKind === 'STUDENT'
              ? [{ person: dto.subjectId }]
              : await m.query(
                  'SELECT inq_std_id::text person FROM amb_acm_csl_inquiry WHERE ent_id=$1 AND inq_id=$2',
                  [entId, dto.subjectId],
                );
          const prior: Array<{ person: string | null }> =
            dto.relatedKind === 'STUDENT'
              ? [{ person: dto.relatedId }]
              : await m.query(
                  'SELECT inq_std_id::text person FROM amb_acm_csl_inquiry WHERE ent_id=$1 AND inq_id=$2',
                  [entId, dto.relatedId],
                );
          if (
            current[0]?.person &&
            prior[0]?.person &&
            current[0].person !== prior[0].person
          )
            throw new BadRequestException('Student identity mismatch');
          validateOpsDate(dto.stoppedDate);
          if (dto.stoppedDate >= dto.effectiveDate)
            throw new BadRequestException('Return must follow interruption');
          const stopped: unknown[] =
            dto.relatedKind === 'STUDENT'
              ? await m.query(
                  `SELECT 1 FROM amb_acm_std_student s WHERE ent_id=$1 AND std_id=$2 AND (std_withdrawn_date=$3 OR std_end_date=$3 OR EXISTS(SELECT 1 FROM amb_acm_dsh_operating_period p WHERE p.ent_id=s.ent_id AND p.subject_id=s.std_id AND p.kind='STUDENT' AND p.end_date=$3 AND p.confirmed AND NOT p.cancelled))`,
                  [entId, dto.relatedId, dto.stoppedDate],
                )
              : await m.query(
                  `SELECT 1 FROM amb_acm_csl_transition WHERE ent_id=$1 AND inq_id=$2 AND to_status='DROPPED' AND (occurred_at AT TIME ZONE 'Asia/Seoul')::date=$3`,
                  [entId, dto.relatedId, dto.stoppedDate],
                );
          if (!stopped.length)
            throw new BadRequestException('No matching interruption evidence');
        }
      }
      if (dto.kind === 'FIRST_PAYMENT') {
        if (!dto.verified)
          throw new BadRequestException('Verify first tuition payment');
        const paid: unknown[] = await m.query(
          `SELECT 1 FROM amb_acm_csl_enrollment e JOIN amb_acm_csl_inquiry i ON i.inq_id=e.inq_id AND i.ent_id=e.ent_id WHERE e.ent_id=$1 AND i.deleted_at IS NULL AND (CASE WHEN $2='STUDENT' THEN i.inq_std_id=$3 ELSE i.inq_id=$3 END) AND e.enr_tuition_paid=true AND e.enr_payment_date=$4 AND e.enr_payment_amount>0`,
          [entId, dto.subjectKind, dto.subjectId, dto.effectiveDate],
        );
        if (!paid.length)
          throw new BadRequestException(
            'Matching paid tuition record required',
          );
      }
      if (['FIRST_CLASS', 'PAYMENT_ENDED'].includes(dto.kind) && !dto.verified)
        throw new BadRequestException('Verify actual first class');
      if (
        dto.kind === 'RETURN' &&
        dto.subjectKind === 'INQUIRY' &&
        dto.relatedKind === 'STUDENT'
      ) {
        const linked = await m.query<Array<{ inq_std_id: string | null }>>(
          'SELECT inq_std_id FROM amb_acm_csl_inquiry WHERE ent_id=$1 AND inq_id=$2 FOR UPDATE',
          [entId, dto.subjectId],
        );
        if (linked[0].inq_std_id && linked[0].inq_std_id !== dto.relatedId)
          throw new BadRequestException('Student identity mismatch');
        await m.query(
          'UPDATE amb_acm_csl_inquiry SET inq_std_id=$3,updated_at=now() WHERE ent_id=$1 AND inq_id=$2',
          [entId, dto.subjectId, dto.relatedId],
        );
      }
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${entId}:${dto.subjectKind}:${dto.subjectId}:${dto.kind}`,
      ]);
      const existing: unknown[] = await m.query(
        `SELECT 1 FROM amb_acm_dsh_lifecycle_event WHERE ent_id=$1 AND subject_kind=$2 AND subject_id=$3 AND kind=$4 AND effective_date=$5 AND payload=$6::jsonb AND cancelled_at IS NULL`,
        [
          entId,
          dto.subjectKind,
          dto.subjectId,
          dto.kind,
          dto.effectiveDate,
          JSON.stringify(dto),
        ],
      );
      if (existing.length) return { saved: true };
      await m.query(
        `INSERT INTO amb_acm_dsh_lifecycle_event(ent_id,subject_kind,subject_id,kind,effective_date,site,payload,actor_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp())`,
        [
          entId,
          dto.subjectKind,
          dto.subjectId,
          dto.kind,
          dto.effectiveDate,
          dto.site,
          dto,
          actorId,
        ],
      );
      return { saved: true };
    });
  }
  async cancel(entId: string, id: string, actorId: string, role?: string) {
    const evidence = await this.ds.query<Array<{ kind: string }>>(
      'SELECT kind FROM amb_acm_dsh_lifecycle_event WHERE ent_id=$1 AND lce_id=$2',
      [entId, id],
    );
    if (
      evidence.some((e) =>
        ['FIRST_PAYMENT', 'FIRST_CLASS', 'PAYMENT_ENDED'].includes(e.kind),
      ) &&
      role !== 'ADMIN'
    )
      throw new ForbiddenException('Administrator confirmation required');
    const rows: unknown[] = await this.ds.query(
      `UPDATE amb_acm_dsh_lifecycle_event SET cancelled_at=now(),cancelled_by=$3,updated_at=now() WHERE ent_id=$1 AND lce_id=$2 AND cancelled_at IS NULL RETURNING lce_id`,
      [entId, id, actorId],
    );
    if (!rows.length) throw new NotFoundException('Record not found');
    return { cancelled: true };
  }
  async list(entId: string, kind: string, id: string) {
    await this.assertSubject(this.ds.manager, entId, kind, id);
    const links =
      kind === 'INQUIRY'
        ? await this.ds.query<Array<{ student: string | null }>>(
            'SELECT inq_std_id::text student FROM amb_acm_csl_inquiry WHERE ent_id=$1 AND inq_id=$2',
            [entId, id],
          )
        : [{ student: id }];
    return this.ds.query(
      `SELECT l.lce_id id,l.kind,l.effective_date::text date,l.payload,l.cancelled_at "cancelledAt" FROM amb_acm_dsh_lifecycle_event l LEFT JOIN amb_acm_csl_inquiry i ON l.subject_kind='INQUIRY' AND i.ent_id=l.ent_id AND i.inq_id=l.subject_id AND i.deleted_at IS NULL WHERE l.ent_id=$1 AND ((l.subject_kind=$2 AND l.subject_id=$3) OR (l.subject_kind='STUDENT' AND l.subject_id=$4::uuid) OR i.inq_std_id=$4::uuid) ORDER BY l.effective_date DESC,l.created_at DESC`,
      [entId, kind, id, links[0]?.student ?? null],
    );
  }
  async range(entId: string, from: string, to: string, site = 'ALL') {
    validateOpsDate(from);
    validateOpsDate(to);
    validateOpsSite(site);
    if (from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 1095)
      throw new BadRequestException('Invalid range');
    const [events, students] = await Promise.all([
      this.ds.query<LifeEvent[]>(
        `SELECT l.lce_id::text id,l.subject_kind "subjectKind",l.subject_id::text "subjectId",COALESCE(s.std_id,i.inq_std_id,i.inq_id)::text person,l.kind,l.effective_date::text date,l.site,l.payload,l.created_at::text "createdAt" FROM amb_acm_dsh_lifecycle_event l LEFT JOIN amb_acm_std_student s ON l.subject_kind='STUDENT' AND s.std_id=l.subject_id AND s.ent_id=l.ent_id AND s.deleted_at IS NULL LEFT JOIN amb_acm_csl_inquiry i ON l.subject_kind='INQUIRY' AND i.inq_id=l.subject_id AND i.ent_id=l.ent_id AND i.deleted_at IS NULL WHERE l.ent_id=$1 AND l.cancelled_at IS NULL AND l.effective_date<=$2 AND (s.std_id IS NOT NULL OR i.inq_id IS NOT NULL) ORDER BY l.effective_date,l.created_at,l.lce_id`,
        [entId, to],
      ),
      this.ds.query<LifeStudent[]>(
        'SELECT std_id::text id,std_site site,std_start_date::text start FROM amb_acm_std_student WHERE ent_id=$1 AND deleted_at IS NULL',
        [entId],
      ),
    ]);
    // Existing confirmed class starts are evidence, not scheduled start dates.
    const starts = await this.ds.query<
      Array<{ id: string; person: string; date: string; site: string }>
    >(
      `SELECT i.inq_id::text id,COALESCE(i.inq_std_id,i.inq_id)::text person,e.cls_started_at::text date,COALESCE(i.inq_site_override,i.inq_source_site,'COMMON') site FROM amb_acm_csl_inquiry i JOIN amb_acm_csl_enrollment e ON e.inq_id=i.inq_id AND e.ent_id=i.ent_id WHERE i.ent_id=$1 AND i.deleted_at IS NULL AND e.cls_started='YES' AND e.cls_started_at IS NOT NULL`,
      [entId],
    );
    events.push(
      ...starts.map((s) => ({
        ...s,
        subjectKind: 'INQUIRY',
        subjectId: s.id,
        kind: 'FIRST_CLASS',
        createdAt: s.date,
        payload: { verified: true },
      })),
    );
    const aliases = new Map<string, string>();
    const root = (id: string): string => {
      let key = id;
      const seen = new Set<string>();
      while (aliases.has(key) && !seen.has(key)) {
        seen.add(key);
        key = aliases.get(key)!;
      }
      return key;
    };
    const inquiryLinks = await this.ds.query<
      Array<{ id: string; person: string }>
    >(
      'SELECT inq_id::text id,COALESCE(inq_std_id,inq_id)::text person FROM amb_acm_csl_inquiry WHERE ent_id=$1 AND deleted_at IS NULL',
      [entId],
    );
    const linkMap = new Map(inquiryLinks.map((i) => [i.id, i.person]));
    const studentIds = new Set(students.map((s) => s.id));
    for (const e of events)
      if (e.kind === 'RETURN' && e.payload.verified && e.payload.relatedId) {
        const prior = root(
          linkMap.get(e.payload.relatedId) ?? e.payload.relatedId,
        );
        const current = root(e.person);
        if (prior !== current) {
          if (studentIds.has(current)) aliases.set(prior, current);
          else aliases.set(current, prior);
        }
      }
    return lifecycleRange(
      events.map((e) => ({ ...e, person: root(e.person) })),
      students,
      from,
      to,
      kstDaysAgo(0),
      site,
    );
  }
  async details(entId: string, date: string, code: string, site = 'ALL') {
    const result = await this.range(entId, date, date, site);
    const keys = result.members[date];
    if (!Object.prototype.hasOwnProperty.call(keys, code))
      throw new BadRequestException('Invalid metric');
    const ids = keys[code as keyof typeof keys];
    const students = await this.ds.query<
      Array<{
        id: string;
        name: string;
        start: string | null;
        site: string;
        kind: string;
      }>
    >(
      `SELECT std_id::text id,std_name name,std_start_date::text start,std_site site,'STUDENT' kind FROM amb_acm_std_student WHERE ent_id=$1 AND std_id=ANY($2::uuid[]) AND deleted_at IS NULL`,
      [entId, ids],
    );
    const inquiries = await this.ds.query<
      Array<{
        id: string;
        person: string;
        ciphertext: Buffer;
        iv: Buffer;
        authTag: Buffer;
        site: string;
      }>
    >(
      `SELECT inq_id::text id,COALESCE(inq_std_id,inq_id)::text person,inq_name_encrypted ciphertext,inq_name_iv iv,inq_name_auth_tag "authTag",COALESCE(inq_site_override,inq_source_site,'COMMON') site FROM amb_acm_csl_inquiry WHERE ent_id=$1 AND COALESCE(inq_std_id,inq_id)=ANY($2::uuid[]) AND deleted_at IS NULL`,
      [entId, ids],
    );
    const seen = new Set(students.map((s) => s.id));
    return [
      ...students,
      ...inquiries
        .filter((i) => {
          if (seen.has(i.person)) return false;
          seen.add(i.person);
          return true;
        })
        .map((i) => ({
          id: i.id,
          name: this.crypto.decrypt(i),
          site: i.site,
          start: null,
          kind: 'INQUIRY',
        })),
    ];
  }
}
