import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { StudentTypeormEntity as Student } from '../../../src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity';
import { TeacherTypeormEntity as Teacher } from '../../../src/modules/acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { StudentTeacherTypeormEntity as Link } from '../../../src/modules/acm-std/infrastructure/typeorm/student-teacher.typeorm-entity';
import { SiteImportService } from '../../../src/modules/acm-std/application/site-import.service';
import { StudentService } from '../../../src/modules/acm-std/application/student.service';
import { ParentService } from '../../../src/modules/acm-std/application/parent.service';
const ent = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222';
const actor = '33333333-3333-4333-8333-333333333333';
const headers = [
  '이름',
  '수업 시작일',
  '성별',
  '연락처',
  '생년월일',
  '학교',
  '학년',
  '거주지',
  '메일',
  'MAP TEST',
  '담당 강사',
  '커리큘럼',
  '수업교재',
  '수업 스케줄',
  '특이사항',
];
function file(name: string, school = 'School') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      headers,
      [name, '2026-08-01', '', '', '', school],
    ]),
    'TPI 현재 등록 학생',
  );
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
// Explicit disposable DB only; never use the application's configured database.
const suite = process.env.STD_TEST_DB_PORT ? describe : describe.skip;
suite('student sites and reviewed imports (isolated PostgreSQL)', () => {
  let ds: DataSource, importer: SiteImportService, students: StudentService;
  beforeAll(async () => {
    ds = await new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: Number(process.env.STD_TEST_DB_PORT),
      username: 'postgres',
      password: 'std-test-only',
      database: 'std_test',
      entities: [Student, Teacher, Link],
      synchronize: true,
    }).initialize();
    const sql = readFileSync(
      resolve(__dirname, '../../../../sql/acm/999o-acm-std-site-import.sql'),
      'utf8',
    );
    await ds.query(sql);
    await ds.query(sql); // migration replay
    await ds.query(
      'CREATE TABLE IF NOT EXISTS amb_acm_csl_inquiry(inq_id uuid, ent_id uuid, inq_std_id uuid, inq_seq_no int, inq_current_stage text, deleted_at timestamptz)',
    );
    importer = new SiteImportService(ds);
    students = new StudentService(
      ds.getRepository(Student),
      ds.getRepository(Teacher),
      ds.getRepository(Link),
      ds,
      {} as ParentService,
    );
  });
  afterAll(async () => {
    await ds?.destroy();
  });
  beforeEach(async () => {
    await ds.query(
      'TRUNCATE amb_acm_std_student, amb_acm_tch_teacher, amb_acm_std_student_teacher, amb_acm_std_site_audit, amb_acm_std_import_preview, amb_acm_std_import_row',
    );
  });
  it('paginates 51 students and counts sites independently from the selected tab', async () => {
    const repo = ds.getRepository(Student);
    await repo.save(
      Array.from({ length: 51 }, (_, i) =>
        repo.create({
          entId: ent,
          name: `Student ${i}`,
          status: 'ACTIVE',
          site: i < 30 ? 'TPI' : null,
        }),
      ),
    );
    await repo.save(
      repo.create({
        entId: other,
        name: 'Other tenant',
        status: 'ACTIVE',
        site: 'TPI',
      }),
    );
    const first = await students.list(ent, {
      limit: 25,
      page: 1,
      sort: 'createdAt',
    });
    const second = await students.list(ent, {
      limit: 25,
      page: 2,
      sort: 'createdAt',
    });
    const third = await students.list(ent, {
      limit: 25,
      page: 3,
      sort: 'createdAt',
    });
    expect(
      new Set(
        [...first.items, ...second.items, ...third.items].map((s) => s.id),
      ).size,
    ).toBe(51);
    const site = await students.list(ent, { site: 'TPI' });
    expect(site.total).toBe(30);
    expect(site.siteCounts).toMatchObject({ ALL: 51, TPI: 30, UNASSIGNED: 21 });
  });
  it('separates current and withdrawn students while retaining integrated site counts', async () => {
    const repo = ds.getRepository(Student);
    await repo.save([
      {entId:ent,name:'Current TPI',site:'TPI',status:'ACTIVE'},
      {entId:ent,name:'Paused Trinity',site:'TRINITY',status:'INACTIVE'},
      {entId:ent,name:'Current Santa',site:'SANTACROCE',status:'ACTIVE'},
      {entId:ent,name:'Unassigned',status:'ACTIVE'},
      {entId:ent,name:'Withdrawn TPI',site:'TPI',status:'WITHDRAWN',withdrawnDate:'2026-08-11'},
      {entId:other,name:'Other tenant',status:'WITHDRAWN'},
    ]);
    const current = await students.list(ent,{scope:'CURRENT',status:'ALL'});
    expect(current.total).toBe(4);
    expect(current.siteCounts).toMatchObject({ALL:4,TPI:1,TRINITY:1,SANTACROCE:1,UNASSIGNED:1});
    expect((await students.list(ent,{scope:'CURRENT',status:'ALL',site:'TPI'})).total).toBe(1);
    const withdrawn = await students.list(ent,{scope:'WITHDRAWN'});
    expect(withdrawn.total).toBe(1); expect(withdrawn.items[0].status).toBe('WITHDRAWN');
    expect((await students.list(ent,{scope:'WITHDRAWN',withdrawnDateFrom:'2026-08-12'})).total).toBe(0);
    expect((await students.list(ent,{status:'ALL'})).total).toBe(5);
    await expect(students.list(ent,{scope:'CURRENT',status:'WITHDRAWN'})).rejects.toThrow('INVALID_STUDENT_SCOPE');
    await expect(students.list(ent,{scope:'WITHDRAWN',status:'ACTIVE'})).rejects.toThrow('INVALID_STUDENT_SCOPE');
  });
  it('records site changes and rejects stale or other-tenant bulk targets atomically', async () => {
    const repo = ds.getRepository(Student);
    const s = await repo.save(repo.create({ entId: ent, name: 'A' }));
    const dto = {
      items: [{ id: s.id, updatedAt: s.updatedAt.toISOString() }],
      site: 'TPI' as const,
      reason: 'review',
    };
    await expect(students.changeSites(other, actor, dto)).rejects.toThrow(
      'STUDENT_NOT_FOUND',
    );
    await students.changeSites(ent, actor, dto);
    expect(
      (
        await ds.query('SELECT actor_id,new_site FROM amb_acm_std_site_audit')
      )[0],
    ).toEqual({ actor_id: actor, new_site: 'TPI' });
    await expect(students.changeSites(ent, actor, dto)).rejects.toThrow(
      'STUDENT_CHANGED',
    );
  });
  it('preview does not write and applies reviewed rows once without portal email guessing', async () => {
    const p = await importer.preview(ent, actor, file('New Student'));
    expect(await ds.getRepository(Student).count()).toBe(0);
    const dto = {
      previewId: p.previewId,
      decisions: [
        {
          key: p.rows[0].key,
          action: 'NEW' as const,
          reviewed: true,
          teacherIds: [],
        },
      ],
    };
    expect(await importer.commit(ent, actor, dto)).toEqual({ applied: 1 });
    expect(await importer.commit(ent, actor, dto)).toEqual({ applied: 1 });
    const again = await importer.preview(ent, actor, file('New Student'));
    expect(again.rows[0].applied).toBe(true);
    expect(await ds.getRepository(Student).count()).toBe(1);
    expect(
      (await ds.getRepository(Student).findOneByOrFail({ entId: ent })).email,
    ).toBeNull();
  });
  it('blocks deleted aliases and isolates preview owner and tenant', async () => {
    await ds
      .getRepository(Student)
      .save({ entId: ent, name: 'Deleted (Alias)', deletedAt: new Date() });
    const p = await importer.preview(ent, actor, file('Deleted'));
    expect(p.rows[0].blocked).toBe(true);
    const dto = {
      previewId: p.previewId,
      decisions: [
        {
          key: p.rows[0].key,
          action: 'NEW' as const,
          reviewed: true,
          teacherIds: [],
        },
      ],
    };
    await expect(importer.commit(other, actor, dto)).rejects.toThrow(
      'PREVIEW_EXPIRED',
    );
    await expect(importer.commit(ent, 'another-actor', dto)).rejects.toThrow(
      'PREVIEW_EXPIRED',
    );
    await expect(importer.commit(ent, actor, dto)).rejects.toThrow(
      'ROW_REQUIRES_REVIEW',
    );
  });
  it('requires identity selection and detects changes after preview', async () => {
    const repo = ds.getRepository(Student);
    const s = await repo.save(
      repo.create({ entId: ent, name: 'Existing', school: 'Original' }),
    );
    const p = await importer.preview(ent, actor, file('Existing'));
    await expect(
      importer.commit(ent, actor, {
        previewId: p.previewId,
        decisions: [
          { key: p.rows[0].key, action: 'NEW', reviewed: true, teacherIds: [] },
        ],
      }),
    ).rejects.toThrow('STUDENT_MATCH_REQUIRED');
    await repo.update(s.id, {
      school: 'Edited',
      updatedAt: new Date(Date.now() + 1000),
    });
    await expect(
      importer.commit(ent, actor, {
        previewId: p.previewId,
        decisions: [
          {
            key: p.rows[0].key,
            action: 'UPDATE',
            studentId: s.id,
            reviewed: true,
            teacherIds: [],
          },
        ],
      }),
    ).rejects.toThrow('STUDENT_CHANGED');
    expect((await repo.findOneByOrFail({ id: s.id })).school).toBe('Edited');
  });
  it('rejects a cross-tenant teacher and rolls back earlier rows in the same commit', async () => {
    const foreign = await ds.getRepository(Teacher).save({entId:other,name:'Teacher',email:'teacher@example.test'});
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers,['First'],['Second']]),'TPI 현재 등록 학생');
    const preview=await importer.preview(ent,actor,Buffer.from(XLSX.write(wb,{type:'buffer',bookType:'xlsx'})));
    await expect(importer.commit(ent,actor,{previewId:preview.previewId,decisions:preview.rows.map((r,i)=>({key:r.key,action:'NEW',reviewed:true,teacherIds:i?[foreign.id]:[]}))})).rejects.toThrow('TEACHER_REQUIRES_REVIEW');
    expect(await ds.getRepository(Student).count()).toBe(0);
    expect(await ds.query('SELECT * FROM amb_acm_std_import_row')).toHaveLength(0);
  });
  it('teacher filter counts each student once and rejects expired previews', async () => {
    const teacher=await ds.getRepository(Teacher).save({entId:ent,name:'Teacher',email:'teacher@example.test'});
    const student=await ds.getRepository(Student).save({entId:ent,name:'Student',site:'TRINITY'});
    await ds.getRepository(Link).save({entId:ent,stdId:student.id,tchId:teacher.id,sortOrder:0});
    const result=await students.list(ent,{teacherId:teacher.id});
    expect(result.total).toBe(1);expect(result.siteCounts.TRINITY).toBe(1);
    const preview=await importer.preview(ent,actor,file('Expired'));
    await ds.query("UPDATE amb_acm_std_import_preview SET expires_at=now()-interval '1 minute' WHERE sip_id=$1",[preview.previewId]);
    await expect(importer.commit(ent,actor,{previewId:preview.previewId,decisions:[{key:preview.rows[0].key,action:'NEW',reviewed:true,teacherIds:[]}]})).rejects.toThrow('PREVIEW_EXPIRED');
  });

});
