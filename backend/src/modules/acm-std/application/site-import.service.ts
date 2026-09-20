import { Cron } from '@nestjs/schedule';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, In, IsNull } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { StudentTypeormEntity } from '../infrastructure/typeorm/student.typeorm-entity';
import { StudentTeacherTypeormEntity } from '../infrastructure/typeorm/student-teacher.typeorm-entity';
import { TeacherTypeormEntity } from '../../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { parseSiteWorkbook, ParsedStudent } from './site-import.parser';
import { CommitSiteImportDto } from './dto/site-import.dto';
export interface Candidate {
  id: string;
  name: string;
  birthDate?: string | null;
  site?: string | null;
  updatedAt: string;
  values: Record<string, unknown>;
}
export interface PreviewRow extends ParsedStudent {
  candidates: Candidate[];
  teacherIds: string[];
  teachers: Array<{ id: string; name: string }>;
  blocked: boolean;
  applied: boolean;
}
interface PreviewRecord {
  sip_id: string;
  file_hash: string;
  payload: PreviewRow[];
  result: { applied: number } | null;
  expires_at: Date;
}
const normalize = (name: string) =>
  name.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
function isCandidate(student: StudentTypeormEntity, row: ParsedStudent) {
  const keys = (name: string) =>
    [normalize(name), normalize(name.replace(/[（(].*?[)）]/g, ''))].filter(
      Boolean,
    );
  return (
    keys(student.name).some((key) => keys(row.name).includes(key)) ||
    (!!row.values.birthDate && student.birthDate === row.values.birthDate)
  );
}
@Injectable()
export class SiteImportService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  @Cron('0 * * * *')
  async purgeExpired() {
    await this.ds.query(
      'DELETE FROM amb_acm_std_import_preview WHERE expires_at < now()',
    );
  }
  async preview(entId: string, actorId: string, buffer: Buffer) {
    if (!buffer?.length || buffer.length > 5 * 1024 * 1024)
      throw new BadRequestException('INVALID_FILE_SIZE');
    const parsed = parseSiteWorkbook(buffer);
    const hash = createHash('sha256').update(buffer).digest('hex');
    const [students, teachers, applied] = await Promise.all([
      this.ds.getRepository(StudentTypeormEntity).find({ where: { entId } }),
      this.ds
        .getRepository(TeacherTypeormEntity)
        .find({ where: { entId, deletedAt: IsNull() } }),
      this.ds.query(
        'SELECT source_key FROM amb_acm_std_import_row WHERE ent_id=$1 AND file_hash=$2',
        [entId, hash],
      ) as Promise<Array<{ source_key: string }>>,
    ]);
    const rows: PreviewRow[] = parsed.map((row) => {
      const matches = students.filter((s) => isCandidate(s, row));
      const teacherIds = row.teacherNames.flatMap((name) => {
        const hits = teachers.filter(
          (t) => normalize(t.name) === normalize(name),
        );
        return hits.length === 1 ? [hits[0].id] : [];
      });
      return {
        ...row,
        teachers: [...new Set(teacherIds)]
          .slice(0, 5)
          .map((id) => ({ id, name: teachers.find((t) => t.id === id)!.name })),
        teacherIds: [...new Set(teacherIds)].slice(0, 5),
        warnings: [
          ...row.warnings,
          ...(teacherIds.length !== row.teacherNames.length
            ? ['TEACHER_REVIEW']
            : []),
        ],
        blocked: row.errors.length > 0 || matches.some((s) => s.deletedAt),
        applied: applied.some((a) => a.source_key === row.key),
        candidates: matches
          .filter((s) => !s.deletedAt)
          .map((s) => ({
            id: s.id,
            name: s.name,
            birthDate: s.birthDate,
            site: s.site,
            updatedAt: s.updatedAt.toISOString(),
            values: Object.fromEntries(
              [...Object.keys(row.values), 'site', 'phone', 'email'].map(
                (key) => [
                  key,
                  (s as unknown as Record<string, unknown>)[key] ?? null,
                ],
              ),
            ),
          })),
      };
    });
    // Expired previews contain personal data; purge on every new preview. Source IDs remain for idempotency.
    await this.ds.query(
      'DELETE FROM amb_acm_std_import_preview WHERE expires_at < now()',
    );
    const saved: Array<{ sip_id: string }> = await this.ds.query(
      'INSERT INTO amb_acm_std_import_preview(ent_id,actor_id,file_hash,payload) VALUES($1,$2,$3,$4::jsonb) RETURNING sip_id',
      [entId, actorId, hash, JSON.stringify(rows)],
    );
    const counts = { NEW: 0, UPDATE: 0, SAME: 0, HOLD: 0, ERROR: 0, DELETED: 0 };
    for (const row of rows) {
      if (row.applied) counts.SAME++;
      else if (row.errors.length) counts.ERROR++;
      else if (row.blocked) counts.DELETED++;
      else if (row.candidates.length > 1) counts.HOLD++;
      else if (!row.candidates.length) counts.NEW++;
      else {
        const c = row.candidates[0];
        const unchanged = c.site === row.site && !row.teacherNames.length &&
          Object.entries(row.values).every(([key, value]) => c.values[key] === value);
        counts[unchanged ? 'SAME' : 'UPDATE']++;
      }
    }
    return { previewId: saved[0].sip_id, rows, counts, expiresInSeconds: 3600 };
  }
  async commit(entId: string, actorId: string, dto: CommitSiteImportDto) {
    if (new Set(dto.decisions.map((d) => d.key)).size !== dto.decisions.length)
      throw new BadRequestException('DUPLICATE_DECISION');
    return this.ds.transaction(async (m) => {
      // Serialize imports in this tenant, including different previews of the same workbook.
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `std-import:${entId}`,
      ]);
      const records: PreviewRecord[] = await m.query(
        'SELECT * FROM amb_acm_std_import_preview WHERE sip_id=$1 AND ent_id=$2 AND actor_id=$3 FOR UPDATE',
        [dto.previewId, entId, actorId],
      );
      const preview = records[0];
      if (!preview || new Date(preview.expires_at).getTime() < Date.now())
        throw new NotFoundException('PREVIEW_EXPIRED');
      if (!Array.isArray(preview.payload)) throw new BadRequestException('INVALID_PREVIEW_TYPE');
      if (preview.result) return preview.result;
      const repo = m.getRepository(StudentTypeormEntity);
      const all = await repo.find({
        where: { entId },
        lock: { mode: 'pessimistic_write' },
        order: { id: 'ASC' },
      });
      const used = new Set<string>();
      let applied = 0;
      await m.query(
        "SELECT set_config('acm.actor_id',$1,true),set_config('acm.change_reason',$2,true)",
        [actorId, `Excel preview ${dto.previewId}`],
      );
      for (const d of dto.decisions) {
        const row = preview.payload.find((r) => r.key === d.key);
        if (!row || row.blocked || !d.reviewed)
          throw new BadRequestException('ROW_REQUIRES_REVIEW');
        const prior: unknown[] = await m.query(
          'SELECT sir_id FROM amb_acm_std_import_row WHERE ent_id=$1 AND file_hash=$2 AND source_key=$3',
          [entId, preview.file_hash, row.key],
        );
        if (prior.length) continue;
        const matches = all.filter((s) => isCandidate(s, row));
        if (matches.some((s) => s.deletedAt))
          throw new ConflictException('DELETED_STUDENT_CONFLICT');
        let student: StudentTypeormEntity;
        if (d.action === 'UPDATE') {
          const candidate = row.candidates.find((c) => c.id === d.studentId);
          const existing = all.find(
            (s) => s.id === d.studentId && !s.deletedAt,
          );
          if (
            !candidate ||
            !existing ||
            candidate.updatedAt !== existing.updatedAt.toISOString()
          )
            throw new ConflictException('STUDENT_CHANGED');
          student = existing;
        } else {
          // Existing name candidates must be resolved; never create a duplicate as an escape hatch.
          if (matches.length)
            throw new ConflictException('STUDENT_MATCH_REQUIRED');
          student = repo.create({ entId, name: row.name, status: 'ACTIVE' });
        }
        if (student.id && used.has(student.id))
          throw new ConflictException('DUPLICATE_STUDENT_TARGET');
        const teachers = d.teacherIds.length
          ? await m
              .getRepository(TeacherTypeormEntity)
              .find({
                where: { entId, id: In(d.teacherIds), deletedAt: IsNull() },
              })
          : [];
        if (
          teachers.length !== d.teacherIds.length ||
          (row.teacherNames.length && !d.teacherIds.length)
        )
          throw new BadRequestException('TEACHER_REQUIRES_REVIEW');
        // Whitelist parsed fields; contact email is only set following an explicit operator decision.
        for (const key of [
          'name',
          'gender',
          'birthDate',
          'school',
          'grade',
          'residence',
          'mapNote',
          'curriculum',
          'materials',
          'specialNote',
          'startDate',
        ] as const) {
          if (row.values[key]) student[key] = row.values[key];
        }
        if (row.values.scheduleText) {
          const schedule =
            student.scheduleJson &&
            typeof student.scheduleJson === 'object' &&
            !Array.isArray(student.scheduleJson)
              ? (student.scheduleJson as Record<string, unknown>)
              : {};
          student.scheduleJson = {
            ...schedule,
            importedText: row.values.scheduleText,
          };
        }
        if (d.email) {
          if (
            all.some(
              (s) =>
                !s.deletedAt &&
                s.id !== student.id &&
                s.email?.toLowerCase() === d.email!.toLowerCase(),
            )
          )
            throw new ConflictException('EMAIL_DUPLICATE');
          student.email = d.email;
        }
        if (d.phone) student.phone = d.phone;
        student.site = row.site;
        student.updatedAt = new Date();
        if (d.teacherIds.length) {
          student.teacherId = d.teacherIds[0];
          student.teacher = d.teacherIds
            .map((id) => teachers.find((t) => t.id === id)!.name)
            .join(', ')
            .slice(0, 100);
        }
        const saved = await repo.save(student);
        if (d.teacherIds.length) {
          const links = m.getRepository(StudentTeacherTypeormEntity);
          await links.delete({ entId, stdId: saved.id });
          await links.save(
            d.teacherIds.map((tchId, sortOrder) =>
              links.create({ entId, stdId: saved.id, tchId, sortOrder }),
            ),
          );
        }
        used.add(saved.id);
        if (!all.some((s) => s.id === saved.id)) all.push(saved);
        await m.query(
          'INSERT INTO amb_acm_std_import_row(ent_id,file_hash,source_key,std_id) VALUES($1,$2,$3,$4)',
          [entId, preview.file_hash, row.key, saved.id],
        );
        applied++;
      }
      const result = { applied };
      await m.query(
        "UPDATE amb_acm_std_import_preview SET result=$1::jsonb,payload='[]'::jsonb,updated_at=now() WHERE sip_id=$2",
        [JSON.stringify(result), dto.previewId],
      );
      return result;
    });
  }
}
