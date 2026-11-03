import { randomUUID } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TeacherClassInfoDto } from '../../../src/modules/acm-std/application/dto/student.dto';
import { PortalClassInfoService } from '../../../src/modules/acm-std/application/portal-class-info.service';
import { PortalTeacherStudentsService } from '../../../src/modules/acm-std/application/portal-teacher-students.service';
import {
  normalizeLink,
  readClassInfos,
  saveClassInfos,
} from '../../../src/modules/acm-std/application/teacher-class-info';
import { StudentTypeormEntity } from '../../../src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261103B — 강사별 수업링크 저장(숨긴 항목 보존)과 포털 수업정보 범위(학생 본인·학부모 자녀).
 * REQ-261103C — 수업링크 여러 개·형식 검사 폐기(https:// 보정, 위험 주소 거부)·강사 포털 등록.
 */
describe('IT-STD-CLASS-INFO-PORTAL', () => {
  let env: AcmTestEnv;
  let svc: PortalClassInfoService;
  let tchSvc: PortalTeacherStudentsService;
  const ENT = '00000000-0000-4000-8000-0000000c1103';
  const [tchA, tchB, std1, std2, other, par] = Array.from({ length: 6 }, () =>
    randomUUID(),
  );

  beforeAll(async () => {
    env = await bootAcmTestEnv();
    svc = new PortalClassInfoService(env.ds);
    tchSvc = new PortalTeacherStudentsService(env.ds);
    await env.ds.query(
      `INSERT INTO amb_acm_tch_teacher (tch_id, ent_id, tch_name, tch_email)
       VALUES ($1,$3,'이강사','a@ci.test'), ($2,$3,'박강사','b@ci.test')`,
      [tchA, tchB, ENT],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_status, std_site)
       VALUES ($1,$4,'김민','ACTIVE','TPI'), ($2,$4,'김윤','ACTIVE','TPI'), ($3,$4,'남학생','ACTIVE','TPI')`,
      [std1, std2, other, ENT],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_std_student_teacher (ent_id, std_id, tch_id, st_sort_order)
       VALUES ($1,$2,$3,0), ($1,$2,$4,1), ($1,$5,$3,0), ($1,$6,$4,0)`,
      [ENT, std1, tchA, tchB, std2, other],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_std_parent (par_id, ent_id, par_name) VALUES ($1,$2,'김부모')`,
      [par, ENT],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_std_student_parent (ent_id, std_id, par_id)
       VALUES ($1,$2,$4), ($1,$3,$4)`,
      [ENT, std1, std2, par],
    );
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  const student = (id: string) =>
    env.ds
      .getRepository(StudentTypeormEntity)
      .findOneByOrFail({ entId: ENT, id });

  it('saves meetingUrl and keeps hidden fields', async () => {
    const s = await student(std1);
    await env.ds.transaction(async (m) => {
      await saveClassInfos(m, s, [tchA, tchB], [
        { tchId: tchA, subject: '영어', mobility: '셔틀', gpa: '3.9' },
        { tchId: tchB, subject: '수학' },
      ]);
      // 새 화면은 과목·교재·수업링크만 보낸다.
      await saveClassInfos(m, s, [tchA, tchB], [
        {
          tchId: tchA,
          subject: '영어 Reading',
          curriculum: 'Wonders 3',
          links: [
            { label: '정규', url: 'https://meet.google.com/abc-defg-hij' },
            { label: '', url: ' zoom.us/j/123 ' },
            { label: '빈 줄', url: '' },
          ],
        },
        { tchId: tchB, subject: '수학', curriculum: '', links: [] },
      ]);
    });
    const { teacherClassInfos } = await readClassInfos(env.ds.manager, s);
    const a = teacherClassInfos.find((x) => x.tchId === tchA);
    expect(a).toMatchObject({
      subject: '영어 Reading',
      curriculum: 'Wonders 3',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      links: [
        { label: '정규', url: 'https://meet.google.com/abc-defg-hij' },
        { label: null, url: 'https://zoom.us/j/123' },
      ],
      mobility: '셔틀',
      gpa: '3.9',
    });
    expect(teacherClassInfos.find((x) => x.tchId === tchB)).toMatchObject({
      subject: '수학',
      curriculum: null,
      meetingUrl: null,
      links: [],
    });
  });

  it('student sees only own class info', async () => {
    const res = await svc.list(ENT, 'STUDENT', std1);
    expect(res).toHaveLength(1);
    expect(res[0].stdName).toBe('김민');
    expect(res[0].teachers.map((t) => t.name)).toEqual(['이강사', '박강사']);
    expect(res[0].teachers[0]).toMatchObject({
      subject: '영어 Reading',
      curriculum: 'Wonders 3',
    });
    expect(res[0].teachers[0].links.map((l) => l.url)).toEqual([
      'https://meet.google.com/abc-defg-hij',
      'https://zoom.us/j/123',
    ]);
    expect(Object.keys(res[0].teachers[0])).not.toContain('mobility');
  });

  it('parent sees each child, never other students', async () => {
    const res = await svc.list(ENT, 'PARENT', par);
    expect(res.map((r) => r.stdName)).toEqual(['김민', '김윤']);
    expect(res[1].teachers).toEqual([
      expect.objectContaining({ name: '이강사', subject: null }),
    ]);
    expect(res.some((r) => r.stdId === other)).toBe(false);
  });

  it('teacher or other tenant gets nothing', async () => {
    expect(await svc.list(ENT, 'TEACHER', tchA)).toEqual([]);
    expect(await svc.list(randomUUID(), 'STUDENT', std1)).toEqual([]);
  });

  it('accepts any internet link, blocks script links', () => {
    expect(normalizeLink('http://example.com/a')).toBe('http://example.com/a');
    expect(normalizeLink('meet.google.com/abc')).toBe('https://meet.google.com/abc');
    expect(normalizeLink('localhost:8080/x')).toBe('https://localhost:8080/x');
    expect(() => normalizeLink('javascript:alert(1)')).toThrow();
    expect(() => normalizeLink('data:text/html,x')).toThrow();
    const errors = (meetingUrl: string) =>
      validateSync(
        plainToInstance(TeacherClassInfoDto, { tchId: tchA, meetingUrl }),
      ).length;
    expect(errors('meet.google.com/abc')).toBe(0);
    expect(errors('http://zoom.us/j/1')).toBe(0);
  });

  it('teacher saves own links only for assigned students', async () => {
    // tchB 는 김민 배정 → 저장 가능, 숨긴 값 유지
    const saved = await tchSvc.saveMyLinks(ENT, tchB, std1, [
      { label: '수학 보충', url: 'meet.google.com/xyz' },
    ]);
    expect(saved.links).toEqual([
      { label: '수학 보충', url: 'https://meet.google.com/xyz' },
    ]);
    const res = await svc.list(ENT, 'STUDENT', std1);
    expect(res[0].teachers.find((x) => x.tchId === tchB)).toMatchObject({
      subject: '수학',
      links: [{ label: '수학 보충', url: 'https://meet.google.com/xyz' }],
    });
    // tchB 는 김윤 미배정 → 403
    await expect(
      tchSvc.saveMyLinks(ENT, tchB, std2, [{ url: 'https://x.test' }]),
    ).rejects.toThrow('NOT_ASSIGNED_STUDENT');
  });
});
