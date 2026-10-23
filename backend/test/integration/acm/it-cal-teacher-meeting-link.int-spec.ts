import { TeacherMeetingLinkService } from '../../../src/modules/acm-cal/application/teacher-meeting-link.service';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261023 (PLN-261023) — assigned teacher sets the Google Meet link from the teacher portal:
 * permission, BODA refusal, URL validation, this-only vs this-and-later (series change),
 * revision rows, and mail only on request.
 */
describe('IT-CAL-TEACHER-LINK teacher-managed class link', () => {
  let env: AcmTestEnv;
  let svc: TeacherMeetingLinkService;
  const ENT = '00000000-0000-4000-8000-0000000c0001';
  const OWNER = '00000000-0000-4000-8000-0000000c0002';
  const TCH = '00000000-0000-4000-8000-0000000c0003';
  const OTHER_TCH = '00000000-0000-4000-8000-0000000c0004';
  const SERIES = '00000000-0000-4000-8000-0000000c0005';
  const BODA_EVT = '00000000-0000-4000-8000-0000000c00b0';
  const evt = (i: number) => `00000000-0000-4000-8000-0000000c010${i}`;
  const day = (i: number) => new Date(Date.UTC(2026, 10, 2 + i * 7, 7, 0, 0));
  const LINK = 'https://meet.google.com/abc-defg-hij';
  const LINK2 = 'https://meet.google.com/xyz-wxyz-xyz';

  beforeAll(async () => {
    env = await bootAcmTestEnv();
    svc = env.app.get(TeacherMeetingLinkService);
    const q = (sql: string, p: unknown[] = []) => env.ds.query(sql, p);
    await q(
      `INSERT INTO amb_acm_cal_video_config (ent_id, vdc_provider) VALUES ($1, 'GOOGLE_MEET')`,
      [ENT],
    );
    await q(
      `INSERT INTO amb_acm_tch_teacher (tch_id, ent_id, tch_name, tch_email) VALUES ($1,$3,'담당강사','t1@it.test'), ($2,$3,'다른강사','t2@it.test')`,
      [TCH, OTHER_TCH, ENT],
    );
    await q(
      `INSERT INTO amb_acm_cal_recurrence_series (crs_id, ent_id, crs_owner_user_id, crs_request_id, crs_request_hash, crs_template, crs_rule, crs_timezone)
       VALUES ($1,$2,$3,gen_random_uuid(),'h',$4::jsonb,'{"freq":"WEEKLY"}'::jsonb,'Asia/Seoul')`,
      [
        SERIES,
        ENT,
        OWNER,
        JSON.stringify({
          evtTitle: '수학A',
          evtCategory: 'REGULAR_CLASS',
          evtStartAt: day(0).toISOString(),
          evtEndAt: day(0).toISOString(),
          evtMeetingProvider: 'NONE',
        }),
      ],
    );
    for (let i = 0; i < 4; i++) {
      await q(
        `INSERT INTO amb_acm_cal_event (evt_id, ent_id, evt_owner_user_id, evt_title, evt_start_at, evt_end_at, evt_category, evt_meeting_provider, evt_assignee_tch_id)
         VALUES ($1,$2,$3,'수학A',$4,$4,'REGULAR_CLASS','NONE',$5)`,
        [evt(i), ENT, OWNER, day(i), TCH],
      );
      await q(
        `INSERT INTO amb_acm_cal_recurrence_occurrence (ent_id, crs_id, cro_key, evt_id) VALUES ($1,$2,$3,$4)`,
        [ENT, SERIES, day(i), evt(i)],
      );
    }
    await q(
      `INSERT INTO amb_acm_cal_invitee (ent_id, evt_id, inv_kind, inv_ref_id) VALUES ($1,$2,'TEACHER',$3)`,
      [ENT, evt(1), TCH],
    );
    await q(
      `INSERT INTO amb_acm_cal_event (evt_id, ent_id, evt_owner_user_id, evt_title, evt_start_at, evt_end_at, evt_category, evt_meeting_provider, evt_meeting_url, evt_assignee_tch_id)
       VALUES ($1,$2,$3,'보다수업',$4,$4,'REGULAR_CLASS','BODASCHOOL','https://boda.example/launch',$5)`,
      [BODA_EVT, ENT, OWNER, day(0), TCH],
    );
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  const links = async () =>
    (
      await env.ds.query<
        { id: string; provider: string; url: string | null }[]
      >(
        `SELECT evt_id id, evt_meeting_provider provider, evt_meeting_url url FROM amb_acm_cal_event WHERE evt_id = ANY($1::uuid[]) ORDER BY evt_start_at`,
        [[0, 1, 2, 3].map(evt)],
      )
    ).map((r) => `${r.provider}:${r.url ?? ''}`);

  it('reports edit rights and the following count', async () => {
    expect(await svc.info(ENT, TCH, evt(1))).toMatchObject({
      canEdit: true,
      recurring: true,
      followingCount: 3,
      provider: 'NONE',
    });
    expect(await svc.info(ENT, OTHER_TCH, evt(1))).toMatchObject({
      canEdit: false,
      reason: 'NOT_ASSIGNEE_TEACHER',
    });
    expect(await svc.info(ENT, TCH, BODA_EVT)).toMatchObject({
      canEdit: false,
      reason: 'BODA_LINK_MANAGED',
    });
  });

  it('rejects other teachers, BODA events and malformed links', async () => {
    await expect(
      svc.update(ENT, OTHER_TCH, evt(1), {
        meetingUrl: LINK,
        scope: 'ONE',
        notify: false,
      }),
    ).rejects.toThrow('NOT_ASSIGNEE_TEACHER');
    await expect(
      svc.update(ENT, TCH, BODA_EVT, {
        meetingUrl: LINK,
        scope: 'ONE',
        notify: false,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      svc.update(ENT, TCH, evt(1), {
        meetingUrl: 'https://zoom.us/j/1',
        scope: 'ONE',
        notify: false,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('changes only this class and records a revision without mail', async () => {
    const r = await svc.update(ENT, TCH, evt(1), {
      meetingUrl: `  ${LINK}  `,
      scope: 'ONE',
      notify: false,
    });
    expect(r).toEqual({ updated: 1, notify: null });
    expect(await links()).toEqual([
      'NONE:',
      `GOOGLE_MEET:${LINK}`,
      'NONE:',
      'NONE:',
    ]);
    const [rev] = await env.ds.query(
      `SELECT rev_reason reason, rev_changes changes FROM amb_acm_cal_event_revision WHERE evt_id=$1`,
      [evt(1)],
    );
    expect(rev.reason).toContain('담당강사');
    expect(rev.changes.map((c: { field: string }) => c.field)).toEqual([
      'meetingProvider',
      'meetingUrl',
    ]);
  });

  it('changes this and later classes and the series for future auto-extension', async () => {
    const r = await svc.update(ENT, TCH, evt(1), {
      meetingUrl: LINK2,
      scope: 'FOLLOWING',
      notify: true,
    });
    expect(r.updated).toBe(3);
    // No SMTP configured for this tenant: mail is attempted only because notify=true, and skipped.
    expect(r.notify).toMatchObject({ sent: 0 });
    expect(await links()).toEqual([
      'NONE:',
      `GOOGLE_MEET:${LINK2}`,
      `GOOGLE_MEET:${LINK2}`,
      `GOOGLE_MEET:${LINK2}`,
    ]);
    const [s] = await env.ds.query(
      `SELECT crs_changes changes, crs_version v FROM amb_acm_cal_recurrence_series WHERE crs_id=$1`,
      [SERIES],
    );
    expect(s.v).toBe(2);
    expect(s.changes.at(-1)).toMatchObject({
      from: day(1).toISOString(),
      patch: { evtMeetingProvider: 'GOOGLE_MEET', evtMeetingUrl: LINK2 },
    });
  });

  it('clears the link with an empty value', async () => {
    await svc.update(ENT, TCH, evt(3), {
      meetingUrl: '',
      scope: 'ONE',
      notify: false,
    });
    expect((await links())[3]).toBe('GOOGLE_MEET:');
  });
});
