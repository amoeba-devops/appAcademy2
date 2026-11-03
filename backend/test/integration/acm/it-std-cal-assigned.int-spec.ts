import { randomUUID } from 'crypto';
import { ParentService } from '../../../src/modules/acm-std/application/parent.service';
import { PortalClassInfoService } from '../../../src/modules/acm-std/application/portal-class-info.service';
import { PortalTeacherStudentsService } from '../../../src/modules/acm-std/application/portal-teacher-students.service';
import { StudentService } from '../../../src/modules/acm-std/application/student.service';
import { StudentTeacherTypeormEntity } from '../../../src/modules/acm-std/infrastructure/typeorm/student-teacher.typeorm-entity';
import { StudentTypeormEntity } from '../../../src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity';
import { TeacherTypeormEntity } from '../../../src/modules/acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261103D — 수업일정(강사 선택·TEACHER 참석자 × STUDENT 참석자)으로 이어진 강사·학생.
 * 학생 상세 수업일정 강사, 강사 포털 수강생 목록·링크 등록, 학생 포털 수업정보. 최근 90일 ~ 앞으로만.
 */
describe('IT-STD-CAL-ASSIGNED', () => {
  let env: AcmTestEnv;
  let students: StudentService;
  let tchSvc: PortalTeacherStudentsService;
  let portal: PortalClassInfoService;
  const ENT = '00000000-0000-4000-8000-0000000d1103';
  const OTHER_ENT = '00000000-0000-4000-8000-0000000d1104';
  const OWNER = randomUUID();
  const [tchA, tchB, tchC, std1, std2, otherStd] = Array.from(
    { length: 6 },
    () => randomUUID(),
  );
  const day = (n: number) => new Date(Date.now() + n * 86_400_000);

  async function event(
    ent: string,
    at: Date,
    opts: {
      assignee?: string;
      teachers?: string[];
      students: string[];
      deleted?: boolean;
    },
  ) {
    const evt = randomUUID();
    await env.ds.query(
      `INSERT INTO amb_acm_cal_event (evt_id, ent_id, evt_owner_user_id, evt_title, evt_start_at,
         evt_end_at, evt_category, evt_meeting_provider, evt_assignee_tch_id, deleted_at)
       VALUES ($1,$2,$3,'수업',$4,$4,'REGULAR_CLASS','NONE',$5,$6)`,
      [
        evt,
        ent,
        OWNER,
        at,
        opts.assignee ?? null,
        opts.deleted ? new Date() : null,
      ],
    );
    for (const [kind, ids] of [
      ['TEACHER', opts.teachers ?? []],
      ['STUDENT', opts.students],
    ] as const)
      for (const id of ids)
        await env.ds.query(
          `INSERT INTO amb_acm_cal_invitee (ent_id, evt_id, inv_kind, inv_ref_id) VALUES ($1,$2,$3,$4)`,
          [ent, evt, kind, id],
        );
  }

  beforeAll(async () => {
    env = await bootAcmTestEnv();
    students = new StudentService(
      env.ds.getRepository(StudentTypeormEntity),
      env.ds.getRepository(TeacherTypeormEntity),
      env.ds.getRepository(StudentTeacherTypeormEntity),
      env.ds,
      { listForStudent: async () => [] } as unknown as ParentService,
    );
    tchSvc = new PortalTeacherStudentsService(env.ds);
    portal = new PortalClassInfoService(env.ds);
    await env.ds.query(
      `INSERT INTO amb_acm_tch_teacher (tch_id, ent_id, tch_name, tch_email)
       VALUES ($1,$4,'가강사','a@cal.test'), ($2,$4,'나강사','b@cal.test'), ($3,$4,'다강사','c@cal.test')`,
      [tchA, tchB, tchC, ENT],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_status, std_site)
       VALUES ($1,$3,'김익용','ACTIVE','TPI'), ($2,$3,'이학생','ACTIVE','TPI')`,
      [std1, std2, ENT],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_status, std_site)
       VALUES ($1,$2,'타학원','ACTIVE','TPI')`,
      [otherStd, OTHER_ENT],
    );
    // 나강사는 학생관리에서 이학생 배정
    await env.ds.query(
      `INSERT INTO amb_acm_std_student_teacher (ent_id, std_id, tch_id, st_sort_order) VALUES ($1,$2,$3,0)`,
      [ENT, std2, tchB],
    );
    await event(ENT, day(2), { assignee: tchA, students: [std1] }); // 다음 수업
    await event(ENT, day(-3), { assignee: tchA, students: [std1] }); // 최근 수업
    await event(ENT, day(-10), { teachers: [tchB], students: [std1, std2] }); // 참석자 강사
    await event(ENT, day(-200), { assignee: tchC, students: [std1] }); // 90일 지남
    await event(ENT, day(5), {
      assignee: tchC,
      students: [std2],
      deleted: true,
    }); // 삭제 일정
    await event(OTHER_ENT, day(1), { assignee: tchA, students: [otherStd] });
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  it('student detail lists calendar teachers', async () => {
    const d = await students.findOne(ENT, std1);
    expect(d.teachers).toEqual([]);
    expect(d.calendarTeachers).toEqual([
      expect.objectContaining({
        tchId: tchA,
        name: '가강사',
        eventCount: 2,
        assigned: false,
      }),
      expect.objectContaining({
        tchId: tchB,
        name: '나강사',
        eventCount: 1,
        nextAt: null,
      }),
    ]);
    const a = d.calendarTeachers.find((x) => x.tchId === tchA)!;
    expect(a.lastAt && a.nextAt).toBeTruthy();
    const d2 = await students.findOne(ENT, std2);
    expect(d2.calendarTeachers).toEqual([
      expect.objectContaining({ tchId: tchB, assigned: true }),
    ]);
  });

  it('teacher portal lists calendar students with sources', async () => {
    const a = await tchSvc.listMyStudents(ENT, tchA);
    expect(a.map((s) => [s.name, s.sources])).toEqual([
      ['김익용', ['CALENDAR']],
    ]);
    const b = await tchSvc.listMyStudents(ENT, tchB);
    expect(b.map((s) => [s.name, s.sources])).toEqual([
      ['김익용', ['CALENDAR']],
      ['이학생', ['ASSIGNED', 'CALENDAR']],
    ]);
    // 90일 지난 일정·삭제 일정만 있는 다강사는 없음
    expect(await tchSvc.listMyStudents(ENT, tchC)).toEqual([]);
    const detail = await tchSvc.getMyStudent(ENT, tchA, std1);
    expect(detail.linksEditable).toBe(true);
    expect(detail.recentEvents).toHaveLength(4); // 기존대로 학생의 삭제 안 된 일정 전체
  });

  it('calendar teacher saves links and the student portal shows them', async () => {
    await tchSvc.saveMyLinks(ENT, tchA, std1, [
      { label: '정규', url: 'meet.google.com/aaa' },
    ]);
    const res = await portal.list(ENT, 'STUDENT', std1);
    expect(res[0].teachers.map((t) => t.name)).toEqual(['가강사', '나강사']);
    expect(res[0].teachers[0].links).toEqual([
      { label: '정규', url: 'https://meet.google.com/aaa' },
    ]);
    await expect(
      tchSvc.saveMyLinks(ENT, tchC, std1, [{ url: 'https://x.test' }]),
    ).rejects.toThrow('NOT_ASSIGNED_STUDENT');
  });
});
