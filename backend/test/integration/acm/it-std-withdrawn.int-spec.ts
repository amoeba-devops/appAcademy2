import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { StudentTypeormEntity as Student } from '../../../src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity';
import { WithdrawnImportService } from '../../../src/modules/acm-std/application/withdrawn-import.service';
import { WITHDRAWN_HEADERS } from '../../../src/modules/acm-std/application/withdrawn-import.parser';
import { ParentTypeormEntity as Parent } from '../../../src/modules/acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { StudentParentTypeormEntity as Link } from '../../../src/modules/acm-std/infrastructure/typeorm/student-parent.typeorm-entity';
import { AesGcmService } from '../../../src/modules/acm-common/crypto/aes-gcm.service';
const ent = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222',
  actor = 'reviewer';
const row = (name: string, id: string) => ({
  이름: name,
  원생고유번호: id,
  입학일: '20260101',
  퇴원일: '20260901',
  재원여부: 'X',
  휴원여부: 'X',
  보호자연락처: '010-0000-0000',
  학교: 'Source school',
  할인액: 0,
});
function file(rows: Record<string, unknown>[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [...WITHDRAWN_HEADERS],
      ...rows.map((r) => WITHDRAWN_HEADERS.map((k) => r[k] ?? '')),
    ]),
    'Sheet0',
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
const suite = process.env.STD_WITHDRAWN_TEST_DB_PORT ? describe : describe.skip;
suite('withdrawn import isolated PostgreSQL', () => {
  let ds: DataSource, service: WithdrawnImportService;
  beforeAll(async () => {
    ds = await new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: Number(process.env.STD_WITHDRAWN_TEST_DB_PORT),
      username: 'postgres',
      password: 'std-test-only',
      database: 'std_test',
      entities: [Student, Parent, Link],
      synchronize: true,
    }).initialize();
    for (const name of [
      '999o-acm-std-site-import.sql',
      '999q-acm-std-withdrawn-record.sql',
    ]) {
      const sql = readFileSync(
        resolve(__dirname, '../../../../sql/acm', name),
        'utf8',
      );
      await ds.query(sql);
      await ds.query(sql);
    }
    service = new WithdrawnImportService(
      ds,
      new AesGcmService(new ConfigService({ ACM_PII_KEY: 'ab'.repeat(32) })),
    );
  });
  afterAll(async () => {
    await ds?.destroy();
  });
  beforeEach(async () => {
    await ds.query(
      'TRUNCATE amb_acm_std_student, amb_acm_std_withdrawn_record, amb_acm_std_withdrawn_audit, amb_acm_std_import_preview CASCADE',
    );
  });
  it('creates withdrawn without email/site, encrypts source and preview, and replays without duplicates', async () => {
    const p = await service.preview(
      ent,
      actor,
      file([row('Synthetic new', '00001')]),
    );
    const dto = {
      previewId: p.previewId,
      decisions: [
        {
          key: '00001',
          action: 'NEW' as const,
          reviewed: true,
          teacherIds: [],
        },
      ],
    };
    expect(
      JSON.stringify(
        (await ds.query('SELECT payload FROM amb_acm_std_import_preview'))[0],
      ),
    ).not.toContain('Synthetic');
    expect(await service.commit(ent, actor, dto)).toMatchObject({
      created: 1,
      updated: 0,
    });
    expect(await service.commit(ent, actor, dto)).toMatchObject({ created: 1 });
    const student = await ds
      .getRepository(Student)
      .findOneByOrFail({ entId: ent });
    expect(student).toMatchObject({
      status: 'WITHDRAWN',
      email: null,
      site: null,
      withdrawnDate: '2026-09-01',
    });
    const record = (await service.records(ent, student.id))[0];
    expect(record.fields['보호자연락처']).toBe('010-0000-0000');
    expect(record.fields['할인액']).toBe(0);
    const stored = (
      await ds.query(
        'SELECT payload_encrypted FROM amb_acm_std_withdrawn_record',
      )
    )[0];
    expect(stored.payload_encrypted.toString()).not.toContain('010-0000');
    const again = await service.preview(
      ent,
      actor,
      file([row('Synthetic new', '00001')]),
    );
    expect(
      await service.commit(ent, actor, {
        previewId: again.previewId,
        decisions: [
          { ...dto.decisions[0], action: 'UPDATE', studentId: student.id },
        ],
      }),
    ).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(await ds.getRepository(Student).count()).toBe(1);
  });
  it('preserves current enrollment and populated fields, records historical withdrawal independently', async () => {
    const s = await ds.getRepository(Student).save({
      entId: ent,
      name: 'Synthetic active',
      status: 'ACTIVE',
      school: 'Current school',
      site: 'TPI',
    });
    const p = await service.preview(ent, actor, file([row(s.name, '00002')]));
    await service.commit(ent, actor, {
      previewId: p.previewId,
      decisions: [
        {
          key: '00002',
          action: 'UPDATE',
          studentId: s.id,
          reviewed: true,
          teacherIds: [],
        },
      ],
    });
    expect(
      await ds.getRepository(Student).findOneByOrFail({ id: s.id }),
    ).toMatchObject({
      status: 'ACTIVE',
      school: 'Current school',
      site: 'TPI',
      withdrawnDate: null,
      admissionDate: '2026-01-01',
    });
    expect((await service.records(ent, s.id))[0].fields['퇴원일']).toBe(
      '2026-09-01',
    );
  });
  it('isolates tenant/actor, detects concurrent edits and rolls back earlier rows', async () => {
    const s = await ds
      .getRepository(Student)
      .save({ entId: ent, name: 'Synthetic old' });
    const p = await service.preview(
      ent,
      actor,
      file([row('Synthetic first', '00003'), row(s.name, '00004')]),
    );
    const dto = {
      previewId: p.previewId,
      decisions: [
        {
          key: '00003',
          action: 'NEW' as const,
          reviewed: true,
          teacherIds: [],
        },
        {
          key: '00004',
          action: 'UPDATE' as const,
          studentId: s.id,
          reviewed: true,
          teacherIds: [],
        },
      ],
    };
    await expect(service.commit(other, actor, dto)).rejects.toThrow(
      'PREVIEW_EXPIRED',
    );
    await expect(service.commit(ent, 'other', dto)).rejects.toThrow(
      'PREVIEW_EXPIRED',
    );
    await ds
      .getRepository(Student)
      .update(s.id, { updatedAt: new Date(Date.now() + 1000) });
    await expect(service.commit(ent, actor, dto)).rejects.toThrow(
      'STUDENT_CHANGED',
    );
    expect(await ds.getRepository(Student).count()).toBe(1);
    expect(
      await ds.query('SELECT * FROM amb_acm_std_withdrawn_record'),
    ).toHaveLength(0);
  });
  it('allows explicitly reviewed distinct names with the same birthday without merging them', async () => {
    await ds
      .getRepository(Student)
      .save({ entId: ent, name: 'Synthetic A', birthDate: '2014-08-07' });
    const source = { ...row('Synthetic B', '00006'), 생일: '20140807' };
    const p = await service.preview(ent, actor, file([source]));
    expect(p.rows[0].candidates).toHaveLength(1);
    expect(
      await service.commit(ent, actor, {
        previewId: p.previewId,
        decisions: [
          { key: '00006', action: 'NEW', reviewed: true, teacherIds: [] },
        ],
      }),
    ).toMatchObject({ created: 1 });
    expect(await ds.getRepository(Student).count()).toBe(2);
    const again = await service.preview(ent, actor, file([source]));
    await expect(
      service.commit(ent, actor, {
        previewId: again.previewId,
        decisions: [
          { key: '00006', action: 'NEW', reviewed: true, teacherIds: [] },
        ],
      }),
    ).rejects.toThrow('STUDENT_MATCH_REQUIRED');
  });
  it('source edits require current revision and reject deleted students', async () => {
    const p = await service.preview(
      ent,
      actor,
      file([row('Synthetic edit', '00005')]),
    );
    await service.commit(ent, actor, {
      previewId: p.previewId,
      decisions: [
        { key: '00005', action: 'NEW', reviewed: true, teacherIds: [] },
      ],
    });
    const s = await ds.getRepository(Student).findOneByOrFail({ entId: ent });
    const r = (await service.records(ent, s.id))[0];
    await service.edit(
      ent,
      s.id,
      r.id,
      actor,
      { ...r.fields, 닉네임: 'Updated' },
      r.updatedAt.toISOString(),
    );
    await expect(
      service.edit(ent, s.id, r.id, actor, r.fields, r.updatedAt.toISOString()),
    ).rejects.toThrow('SOURCE_CHANGED');
    await ds.getRepository(Student).update(s.id, { deletedAt: new Date() });
    await expect(
      service.edit(ent, s.id, r.id, actor, r.fields, r.updatedAt.toISOString()),
    ).rejects.toThrow('STUDENT_NOT_FOUND');
  });
});
