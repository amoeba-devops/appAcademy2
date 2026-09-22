import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { createHash } from 'crypto';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { StudentTypeormEntity } from '../infrastructure/typeorm/student.typeorm-entity';
import {
  normalizeWithdrawnFields,
  parseWithdrawnWorkbook,
  WithdrawnFields,
  WithdrawnRow,
} from './withdrawn-import.parser';
import { CommitSiteImportDto } from './dto/site-import.dto';
import { applyWithdrawnDateDefaults } from './withdrawn-dates';
interface Envelope {
  ciphertext: string;
  iv: string;
  authTag: string;
}
interface SourceRecord {
  swr_id: string;
  std_id: string;
  external_id: string;
  updated_at: Date;
  payload_encrypted: Buffer;
  payload_iv: Buffer;
  payload_auth_tag: Buffer;
}
export interface ReviewRow extends WithdrawnRow {
  candidates: Array<{
    id: string;
    name: string;
    status: string;
    birthDate?: string | null;
    updatedAt: string;
    fields: Record<string, string | null>;
  }>;
  linkedId?: string;
  linkedUpdatedAt?: string;
  blocked: boolean;
}
const SOURCE = 'WITHDRAWN_ROSTER_V1';
@Injectable()
export class WithdrawnImportService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly crypto: AesGcmService,
  ) {}
  private seal(value: unknown): Envelope {
    const e = this.crypto.encrypt(JSON.stringify(value));
    return {
      ciphertext: e.ciphertext.toString('base64'),
      iv: e.iv.toString('base64'),
      authTag: e.authTag.toString('base64'),
    };
  }
  private unseal<T>(value: Envelope): T {
    return JSON.parse(
      this.crypto.decrypt({
        ciphertext: Buffer.from(value.ciphertext, 'base64'),
        iv: Buffer.from(value.iv, 'base64'),
        authTag: Buffer.from(value.authTag, 'base64'),
      }),
    ) as T;
  }
  private decode(record: SourceRecord): WithdrawnFields {
    return JSON.parse(
      this.crypto.decrypt({
        ciphertext: record.payload_encrypted,
        iv: record.payload_iv,
        authTag: record.payload_auth_tag,
      }),
    ) as WithdrawnFields;
  }
  private sameName(student: StudentTypeormEntity, row: WithdrawnRow) {
    const keys = (name: string) =>
      [name, name.replace(/[（(].*?[)）]/g, '')]
        .map((v) => v.normalize('NFKC').replace(/\s+/g, '').toLowerCase())
        .filter(Boolean);
    return keys(student.name).some((key) =>
      keys(String(row.fields['이름'])).includes(key),
    );
  }
  private matches(student: StudentTypeormEntity, row: WithdrawnRow) {
    return (
      this.sameName(student, row) ||
      (!!row.fields['생일'] && student.birthDate === row.fields['생일'])
    );
  }
  async preview(entId: string, actor: string, buffer: Buffer) {
    if (!buffer?.length || buffer.length > 5 * 1024 * 1024)
      throw new BadRequestException('INVALID_FILE_SIZE');
    const parsed = parseWithdrawnWorkbook(buffer);
    const students = await this.ds
      .getRepository(StudentTypeormEntity)
      .find({ where: { entId } });
    const records: SourceRecord[] = await this.ds.query(
      'SELECT * FROM amb_acm_std_withdrawn_record WHERE ent_id=$1 AND source_system=$2',
      [entId, SOURCE],
    );
    const contacts: Array<{ std_id: string; par_phone: string }> =
      await this.ds.query(
        'SELECT sp.std_id,p.par_phone FROM amb_acm_std_student_parent sp JOIN amb_acm_std_parent p ON p.par_id=sp.par_id AND p.ent_id=sp.ent_id WHERE sp.ent_id=$1 AND p.deleted_at IS NULL AND p.par_phone IS NOT NULL',
        [entId],
      );
    const rows: ReviewRow[] = parsed.map((row) => {
      const linked = records.find((r) => r.external_id === row.key);
      const matches = students.filter((s) =>
        linked ? s.id === linked.std_id : this.matches(s, row),
      );
      return {
        ...row,
        linkedId: linked?.std_id,
        linkedUpdatedAt: linked?.updated_at.toISOString(),
        blocked:
          !!row.errors.length || matches.some((s) => s.deletedAt != null),
        candidates: matches
          .filter((s) => !s.deletedAt)
          .map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            birthDate: s.birthDate,
            updatedAt: s.updatedAt.toISOString(),
            fields: {
              이름: s.name,
              보호자연락처:
                contacts
                  .filter((p) => p.std_id === s.id)
                  .map((p) => p.par_phone)
                  .join(' / ') || null,
              생일: s.birthDate ?? null,
              학교: s.school ?? null,
              학년: s.grade ?? null,
              원생연락처: s.phone ?? null,
              원생이메일: s.email ?? null,
              입학일: s.admissionDate ?? null,
              퇴원일: s.withdrawnDate ?? null,
              메모: s.specialNote ?? null,
            },
          })),
      };
    });
    await this.ds.query(
      'DELETE FROM amb_acm_std_import_preview WHERE expires_at<now()',
    );
    const stored: Array<{ sip_id: string }> = await this.ds.query(
      'INSERT INTO amb_acm_std_import_preview(ent_id,actor_id,file_hash,payload) VALUES($1,$2,$3,$4::jsonb) RETURNING sip_id',
      [
        entId,
        actor,
        createHash('sha256').update(buffer).digest('hex'),
        JSON.stringify({ kind: SOURCE, ...this.seal(rows) }),
      ],
    );
    return {
      previewId: stored[0].sip_id,
      rows,
      policy: 'PRESERVE_EXISTING_STATUS',
      counts: {
        total: rows.length,
        new: rows.filter((r) => !r.blocked && !r.candidates.length).length,
        existing: rows.filter((r) => !r.blocked && r.candidates.length === 1)
          .length,
        hold: rows.filter((r) => r.blocked || r.candidates.length > 1).length,
      },
    };
  }
  async commit(entId: string, actor: string, dto: CommitSiteImportDto) {
    if (new Set(dto.decisions.map((d) => d.key)).size !== dto.decisions.length)
      throw new BadRequestException('DUPLICATE_DECISION');
    return this.ds.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `std-import:${entId}`,
      ]);
      const previews: Array<{
        payload: Envelope & { kind: string };
        file_hash: string;
        expires_at: Date;
        result: unknown;
      }> = await m.query(
        'SELECT * FROM amb_acm_std_import_preview WHERE sip_id=$1 AND ent_id=$2 AND actor_id=$3 FOR UPDATE',
        [dto.previewId, entId, actor],
      );
      const preview = previews[0];
      if (
        !preview ||
        preview.payload.kind !== SOURCE ||
        preview.expires_at.getTime() < Date.now()
      )
        throw new NotFoundException('PREVIEW_EXPIRED');
      if (preview.result) return preview.result;
      const rows = this.unseal<ReviewRow[]>(preview.payload);
      const repo = m.getRepository(StudentTypeormEntity);
      const all = await repo.find({
        where: { entId },
        lock: { mode: 'pessimistic_write' },
        order: { id: 'ASC' },
      });
      const used = new Set<string>();
      let created = 0,
        updated = 0,
        unchanged = 0;
      for (const decision of dto.decisions) {
        const row = rows.find((r) => r.key === decision.key);
        if (!row || row.blocked || !decision.reviewed)
          throw new BadRequestException('ROW_REQUIRES_REVIEW');
        const existingRecords: SourceRecord[] = await m.query(
          'SELECT * FROM amb_acm_std_withdrawn_record WHERE ent_id=$1 AND source_system=$2 AND external_id=$3 FOR UPDATE',
          [entId, SOURCE, row.key],
        );
        const record = existingRecords[0];
        if (
          record &&
          (!row.linkedId ||
            record.updated_at.toISOString() !== row.linkedUpdatedAt)
        )
          throw new ConflictException('SOURCE_CHANGED');
        const matches = all.filter((s) => this.matches(s, row));
        if (matches.some((s) => s.deletedAt))
          throw new ConflictException('DELETED_STUDENT_CONFLICT');
        let student: StudentTypeormEntity;
        const isNew = decision.action === 'NEW';
        if (isNew) {
          if (matches.some((s) => this.sameName(s, row)) || record)
            throw new ConflictException('STUDENT_MATCH_REQUIRED');
          student = repo.create({
            entId,
            name: String(row.fields['이름']),
            status: 'WITHDRAWN',
            site: null,
          });
        } else {
          const candidate = row.candidates.find(
            (c) => c.id === decision.studentId,
          );
          const found = all.find(
            (s) => s.id === decision.studentId && !s.deletedAt,
          );
          if (
            !candidate ||
            !found ||
            candidate.updatedAt !== found.updatedAt.toISOString() ||
            (record && record.std_id !== found.id)
          )
            throw new ConflictException('STUDENT_CHANGED');
          if (
            row.fields['생일'] &&
            found.birthDate &&
            row.fields['생일'] !== found.birthDate
          )
            throw new ConflictException('BIRTH_DATE_CONFLICT');
          student = found;
        }
        if (student.id && used.has(student.id))
          throw new ConflictException('DUPLICATE_STUDENT_TARGET');
        const before = JSON.stringify(student);
        const oldFields = record ? this.decode(record) : null;
        const fill = (
          key:
            | 'gender'
            | 'birthDate'
            | 'school'
            | 'grade'
            | 'phone'
            | 'email'
            | 'specialNote'
            | 'admissionDate'
            | 'withdrawnDate'
            | 'withdrawnReason',
          value: unknown,
        ) => {
          if (value != null && value !== '' && !student[key])
            student[key] = String(value);
        };
        fill(
          'gender',
          row.fields['성별'] === '남'
            ? 'M'
            : row.fields['성별'] === '여'
              ? 'F'
              : null,
        );
        for (const [field, key] of [
          ['birthDate', '생일'],
          ['school', '학교'],
          ['grade', '학년'],
          ['phone', '원생연락처'],
          ['email', '원생이메일'],
          ['specialNote', '메모'],
          ['admissionDate', '입학일'],
        ] as const)
          fill(field, row.fields[key]);
        if (student.status === 'WITHDRAWN') {
          fill('withdrawnDate', row.fields['퇴원일']);
          fill('withdrawnReason', row.fields['퇴원사유']);
        }
        // RPT-260922D B — 수업 시작/종료일이 비면 입학/퇴원일로 채운다(대시보드 집계).
        applyWithdrawnDateDefaults(student);
        if (
          student.email &&
          all.some(
            (s) =>
              s.id !== student.id &&
              !s.deletedAt &&
              s.email?.toLowerCase() === student.email?.toLowerCase(),
          )
        )
          throw new ConflictException('EMAIL_DUPLICATE');
        // Existing values win. New source information fills gaps; no old source overwrites.
        const fields: WithdrawnFields = { ...row.fields };
        if (oldFields)
          for (const [key, value] of Object.entries(oldFields))
            if (value !== null && value !== '') fields[key] = value;
        const changed =
          isNew ||
          before !== JSON.stringify(student) ||
          !oldFields ||
          JSON.stringify(fields) !== JSON.stringify(oldFields);
        if (changed) {
          student.updatedAt = new Date();
          await repo.save(student);
          const encrypted = this.crypto.encrypt(JSON.stringify(fields));
          const ids: Array<{ swr_id: string }> = await m.query(
            'INSERT INTO amb_acm_std_withdrawn_record(ent_id,std_id,source_system,external_id,payload_encrypted,payload_iv,payload_auth_tag,file_hash,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(ent_id,source_system,external_id) DO UPDATE SET payload_encrypted=EXCLUDED.payload_encrypted,payload_iv=EXCLUDED.payload_iv,payload_auth_tag=EXCLUDED.payload_auth_tag,file_hash=EXCLUDED.file_hash,actor_id=EXCLUDED.actor_id,updated_at=now() RETURNING swr_id',
            [
              entId,
              student.id,
              SOURCE,
              row.key,
              encrypted.ciphertext,
              encrypted.iv,
              encrypted.authTag,
              preview.file_hash,
              actor,
            ],
          );
          await this.audit(
            m,
            entId,
            student.id,
            ids[0].swr_id,
            actor,
            isNew ? 'CREATE' : 'SUPPLEMENT',
            {
              before: JSON.parse(before) as unknown,
              previousSource: oldFields,
              after: student,
              source: fields,
            },
          );
          if (isNew) {
            created++;
            all.push(student);
          } else updated++;
        } else unchanged++;
        used.add(student.id);
      }
      const result = {
        created,
        updated,
        unchanged,
        policy: 'PRESERVE_EXISTING_STATUS',
      };
      await m.query(
        'UPDATE amb_acm_std_import_preview SET result=$1::jsonb,updated_at=now() WHERE sip_id=$2',
        [JSON.stringify(result), dto.previewId],
      );
      return result;
    });
  }
  private async audit(
    m: EntityManager,
    entId: string,
    stdId: string,
    recordId: string,
    actor: string,
    action: string,
    data: unknown,
  ) {
    const e = this.crypto.encrypt(JSON.stringify(data));
    await m.query(
      'INSERT INTO amb_acm_std_withdrawn_audit(ent_id,std_id,swr_id,actor_id,action,payload_encrypted,payload_iv,payload_auth_tag) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [entId, stdId, recordId, actor, action, e.ciphertext, e.iv, e.authTag],
    );
  }
  async records(entId: string, stdId: string) {
    if (
      !(await this.ds
        .getRepository(StudentTypeormEntity)
        .findOne({ where: { id: stdId, entId, deletedAt: IsNull() } }))
    )
      throw new NotFoundException('STUDENT_NOT_FOUND');
    const records: SourceRecord[] = await this.ds.query(
      'SELECT * FROM amb_acm_std_withdrawn_record WHERE ent_id=$1 AND std_id=$2 ORDER BY created_at',
      [entId, stdId],
    );
    return records.map((r) => ({
      id: r.swr_id,
      externalId: r.external_id,
      updatedAt: r.updated_at,
      fields: this.decode(r),
    }));
  }
  async edit(
    entId: string,
    stdId: string,
    recordId: string,
    actor: string,
    fields: Record<string, unknown>,
    expected: string,
  ) {
    const parsed = normalizeWithdrawnFields(fields);
    if (parsed.errors.length) throw new BadRequestException(parsed.errors);
    return this.ds.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `std-import:${entId}`,
      ]);
      const student = await m.getRepository(StudentTypeormEntity).findOne({
        where: { id: stdId, entId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');
      const records: SourceRecord[] = await m.query(
        'SELECT * FROM amb_acm_std_withdrawn_record WHERE ent_id=$1 AND std_id=$2 AND swr_id=$3 FOR UPDATE',
        [entId, stdId, recordId],
      );
      const record = records[0];
      if (!record) throw new NotFoundException('RECORD_NOT_FOUND');
      if (record.updated_at.toISOString() !== expected)
        throw new ConflictException('SOURCE_CHANGED');
      if (parsed.fields['원생고유번호'] !== record.external_id)
        throw new BadRequestException('EXTERNAL_ID_IMMUTABLE');
      const e = this.crypto.encrypt(JSON.stringify(parsed.fields));
      await m.query(
        'UPDATE amb_acm_std_withdrawn_record SET payload_encrypted=$1,payload_iv=$2,payload_auth_tag=$3,updated_at=now(),actor_id=$4 WHERE swr_id=$5 AND ent_id=$6',
        [e.ciphertext, e.iv, e.authTag, actor, recordId, entId],
      );
      await this.audit(m, entId, stdId, recordId, actor, 'EDIT', {
        before: this.decode(record),
        after: parsed.fields,
      });
      return { saved: true };
    });
  }
}
