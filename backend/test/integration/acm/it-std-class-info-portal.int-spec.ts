import { randomUUID } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TeacherClassInfoDto } from '../../../src/modules/acm-std/application/dto/student.dto';
import { PortalClassInfoService } from '../../../src/modules/acm-std/application/portal-class-info.service';
import {
  readClassInfos,
  saveClassInfos,
} from '../../../src/modules/acm-std/application/teacher-class-info';
import { StudentTypeormEntity } from '../../../src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261103B — 강사별 수업링크 저장(숨긴 항목 보존)과 포털 수업정보 범위(학생 본인·학부모 자녀).
 */
describe('IT-STD-CLASS-INFO-PORTAL', () => {
  let env: AcmTestEnv;
  let svc: PortalClassInfoService;
  const ENT = '00000000-0000-4000-8000-0000000c1103';
  const [tchA, tchB, std1, std2, other, par] = Array.from({ length: 6 }, () =>
    randomUUID(),
  );

  beforeAll(async () => {
    env = await bootAcmTestEnv();
    svc = new PortalClassInfoService(env.ds);
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
          meetingUrl: 'https://meet.google.com/abc-defg-hij',
        },
        { tchId: tchB, subject: '수학', curriculum: '', meetingUrl: '' },
      ]);
    });
    const { teacherClassInfos } = await readClassInfos(env.ds.manager, s);
    const a = teacherClassInfos.find((x) => x.tchId === tchA);
    expect(a).toMatchObject({
      subject: '영어 Reading',
      curriculum: 'Wonders 3',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      mobility: '셔틀',
      gpa: '3.9',
    });
    expect(teacherClassInfos.find((x) => x.tchId === tchB)).toMatchObject({
      subject: '수학',
      curriculum: null,
      meetingUrl: null,
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
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    });
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

  it('accepts only https meeting links', () => {
    const errors = (meetingUrl: string) =>
      validateSync(
        plainToInstance(TeacherClassInfoDto, { tchId: tchA, meetingUrl }),
      ).length;
    expect(errors('https://meet.google.com/abc-defg-hij')).toBe(0);
    expect(errors('https://zoom.us/j/123')).toBe(0);
    expect(errors('')).toBe(0);
    expect(errors('http://meet.google.com/abc')).toBeGreaterThan(0);
    expect(errors('meet.google.com/abc')).toBeGreaterThan(0);
  });
});
