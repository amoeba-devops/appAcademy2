import request from 'supertest';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/** REQ-261023B — link students to class events by the name in the title (preview / apply). */
describe('IT-CAL-STUDENT-LINK title-based student linking', () => {
  let env: AcmTestEnv;
  const ENT = '00000000-0000-4000-8000-0000000d0001';
  const ADMIN = '00000000-0000-4000-8000-0000000d0002';
  const OTHER_ENT = '00000000-0000-4000-8000-0000000d0009';
  const STD = {
    rael: '00000000-0000-4000-8000-0000000d0101',
    min: '00000000-0000-4000-8000-0000000d0102',
    minjae: '00000000-0000-4000-8000-0000000d0103',
    yg: '00000000-0000-4000-8000-0000000d0104',
    yh: '00000000-0000-4000-8000-0000000d0105',
    gone: '00000000-0000-4000-8000-0000000d0106',
    foreign: '00000000-0000-4000-8000-0000000d0107',
  };
  const SERIES = '00000000-0000-4000-8000-0000000d0201';
  const ev = (n: number) =>
    `00000000-0000-4000-8000-0000000d03${String(n).padStart(2, '0')}`;
  const today = new Date();
  const at = (days: number) => new Date(today.getTime() + days * 86_400_000);
  const kst = (d: Date) =>
    d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);

  beforeAll(async () => {
    env = await bootAcmTestEnv();
    const q = (sql: string, p: unknown[] = []) => env.ds.query(sql, p);
    const students: [string, string, string, string][] = [
      [STD.rael, ENT, '김라엘', 'ACTIVE'],
      [STD.min, ENT, '김민', 'ACTIVE'],
      [STD.minjae, ENT, '김민재', 'ACTIVE'],
      [STD.yg, ENT, '이윤건', 'ACTIVE'],
      [STD.yh, ENT, '이윤후', 'ACTIVE'],
      [STD.gone, ENT, '송퇴원', 'WITHDRAWN'],
      [STD.foreign, OTHER_ENT, '김라엘', 'ACTIVE'],
    ];
    for (const [id, ent, name, status] of students)
      await q(
        `INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_status, std_site, std_withdrawn_date) VALUES ($1,$2,$3,$4,'TPI',$5)`,
        [id, ent, name, status, status === 'WITHDRAWN' ? kst(at(-30)) : null],
      );
    const titles = [
      '김라엘 (오프라인)',
      '김라엘 (오프라인)',
      '김민재',
      '이윤건, 이윤후 (오프라인)',
      '수업 가능 시간',
      '송퇴원',
    ];
    for (let i = 0; i < titles.length; i++)
      await q(
        `INSERT INTO amb_acm_cal_event (evt_id, ent_id, evt_owner_user_id, evt_title, evt_start_at, evt_end_at, evt_category, evt_meeting_provider)
         VALUES ($1,$2,$3,$4,$5,$5,'REGULAR_CLASS','NONE')`,
        [ev(i), ENT, ADMIN, titles[i], at(i + 1)],
      );
    // Already linked event — never offered again.
    await q(
      `INSERT INTO amb_acm_cal_event (evt_id, ent_id, evt_owner_user_id, evt_title, evt_start_at, evt_end_at, evt_category, evt_meeting_provider) VALUES ($1,$2,$3,'김라엘 (오프라인)',$4,$4,'REGULAR_CLASS','NONE')`,
      [ev(20), ENT, ADMIN, at(2)],
    );
    await q(
      `INSERT INTO amb_acm_cal_invitee (ent_id, evt_id, inv_kind, inv_ref_id) VALUES ($1,$2,'STUDENT',$3)`,
      [ENT, ev(20), STD.rael],
    );
    // The two 김라엘 events are a recurring series.
    await q(
      `INSERT INTO amb_acm_cal_recurrence_series (crs_id, ent_id, crs_owner_user_id, crs_request_id, crs_request_hash, crs_template, crs_rule, crs_timezone)
       VALUES ($1,$2,$3,gen_random_uuid(),'h','{"evtTitle":"김라엘 (오프라인)"}'::jsonb,'{"freq":"WEEKLY"}'::jsonb,'Asia/Seoul')`,
      [SERIES, ENT, ADMIN],
    );
    for (const i of [0, 1])
      await q(
        `INSERT INTO amb_acm_cal_recurrence_occurrence (ent_id, crs_id, cro_key, evt_id) VALUES ($1,$2,$3,$4)`,
        [ENT, SERIES, at(i + 1), ev(i)],
      );
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  const http = () => request(env.app.getHttpServer());
  const as = (role = 'ADMIN') => ({
    'x-test-user': ADMIN,
    'x-test-ent': ENT,
    'x-test-role': role,
  });
  const range = `from=${kst(at(-7))}&to=${kst(at(90))}`;
  type Group = {
    title: string;
    eventIds: string[];
    state: string;
    candidates: { stdId: string; name: string; suppressedBy?: string }[];
  };

  it('groups unlinked events by title with matched students (preview writes nothing)', async () => {
    const r = await http()
      .get(`/api/acm/cal/student-links/preview?${range}`)
      .set(as())
      .expect(200);
    const g = (t: string) =>
      (r.body.groups as Group[]).find((x) => x.title === t)!;
    expect(g('김라엘 (오프라인)')).toMatchObject({
      state: 'SURE',
      eventIds: [ev(0), ev(1)],
    });
    expect(g('김라엘 (오프라인)').candidates.map((c) => c.stdId)).toEqual([
      STD.rael,
    ]); // other tenant excluded
    expect(g('김민재').state).toBe('SURE');
    expect(
      g('김민재').candidates.find((c) => c.name === '김민')?.suppressedBy,
    ).toBe('김민재');
    expect(g('이윤건, 이윤후 (오프라인)').state).toBe('MULTI');
    expect(g('수업 가능 시간').state).toBe('NONE');
    expect(g('송퇴원').state).toBe('NONE'); // withdrawn excluded by default
    const withGone = await http()
      .get(`/api/acm/cal/student-links/preview?${range}&includeWithdrawn=true`)
      .set(as())
      .expect(200);
    expect(
      (withGone.body.groups as Group[]).find((x) => x.title === '송퇴원')!
        .state,
    ).toBe('SURE');
    expect(r.body.summary).toMatchObject({
      events: 6,
      sure: 3,
      multi: 1,
      none: 2,
    });
    const [{ n }] = await env.ds.query(
      `SELECT count(*)::int n FROM amb_acm_cal_invitee WHERE ent_id=$1`,
      [ENT],
    );
    expect(n).toBe(1);
  });

  it('denies non-admins and rejects mismatched titles or foreign students', async () => {
    await http()
      .get(`/api/acm/cal/student-links/preview?${range}`)
      .set(as('TEACHER'))
      .expect(403);
    await http()
      .post('/api/acm/cal/student-links/apply')
      .set(as())
      .send({
        items: [{ title: '김민재', eventIds: [ev(0)], stdIds: [STD.minjae] }],
      })
      .expect(400);
    await http()
      .post('/api/acm/cal/student-links/apply')
      .set(as())
      .send({
        items: [
          {
            title: '김라엘 (오프라인)',
            eventIds: [ev(0)],
            stdIds: [STD.foreign],
          },
        ],
      })
      .expect(400);
  });

  it('links students without mail, records revisions and the series change, and is idempotent', async () => {
    const body = {
      items: [
        {
          title: '김라엘 (오프라인)',
          eventIds: [ev(0), ev(1)],
          stdIds: [STD.rael],
        },
        {
          title: '이윤건, 이윤후 (오프라인)',
          eventIds: [ev(3)],
          stdIds: [STD.yg, STD.yh],
        },
      ],
    };
    const r = await http()
      .post('/api/acm/cal/student-links/apply')
      .set(as())
      .send(body)
      .expect(200);
    expect(r.body).toMatchObject({
      linkedEvents: 3,
      addedInvitees: 4,
      skippedExisting: 0,
      seriesUpdated: 1,
      studentsWithoutPortal: 3,
    });
    const inv = await env.ds.query(
      `SELECT evt_id::text e, inv_ref_id::text s, inv_notify_status st FROM amb_acm_cal_invitee WHERE ent_id=$1 AND inv_kind='STUDENT' AND evt_id <> $2 ORDER BY 1,2`,
      [ENT, ev(20)],
    );
    expect(inv).toHaveLength(4);
    expect(inv.every((i: { st: string | null }) => i.st === null)).toBe(true); // no mail
    const [rev] = await env.ds.query(
      `SELECT rev_reason r, rev_editor_user_id::text u FROM amb_acm_cal_event_revision WHERE evt_id=$1`,
      [ev(3)],
    );
    expect(rev).toEqual({ r: '제목 기반 학생 연결', u: ADMIN });
    const [s] = await env.ds.query(
      `SELECT crs_changes c, crs_version v FROM amb_acm_cal_recurrence_series WHERE crs_id=$1`,
      [SERIES],
    );
    expect(s.v).toBe(2);
    expect(s.c.at(-1).patch.evtInvitees).toEqual([
      { kind: 'STUDENT', refId: STD.rael },
    ]);

    const again = await http()
      .post('/api/acm/cal/student-links/apply')
      .set(as())
      .send(body)
      .expect(200);
    expect(again.body).toMatchObject({
      linkedEvents: 0,
      addedInvitees: 0,
      skippedExisting: 4,
      seriesUpdated: 0,
    });
    const after = await http()
      .get(`/api/acm/cal/student-links/preview?${range}`)
      .set(as())
      .expect(200);
    expect((after.body.groups as Group[]).map((g) => g.title).sort()).toEqual(
      ['김민재', '송퇴원', '수업 가능 시간'].sort(),
    );
  });
});
