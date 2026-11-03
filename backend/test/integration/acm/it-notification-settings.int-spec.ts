import { randomUUID } from 'crypto';
import { enqueueInbox } from '../../../src/modules/acm-notification/application/inbox-outbox';
import { NotificationSettingsService } from '../../../src/modules/acm-notification/application/notification-settings.service';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261102B — 알림 설정: 상황 끄기·받는 역할 좁히기·개인 알림함 끄기가 outbox 수신자에 반영되고,
 * 저장 요청은 엄격히 검사한다.
 */
describe('IT-NOTIFICATION-SETTINGS', () => {
  let env: AcmTestEnv;
  let svc: NotificationSettingsService;
  const ENT = '00000000-0000-0000-0000-000000000001';
  let adminId: string;
  let staffId: string;
  let actorId: string;

  const addUser = async (email: string, role: string) =>
    (
      await env.ds.query<{ id: string }[]>(
        `INSERT INTO amb_acm_user (ent_id, usr_email, usr_name, usr_status, usr_role)
         VALUES ($1, $2, $2, 'ACTIVE', $3) RETURNING usr_id AS id`,
        [ENT, email, role],
      )
    )[0].id;
  /** 상담 접수 알림 한 건을 넣고 그 수신자(콘솔 사용자 id)를 돌려준다. */
  const recipients = async (type = 'CSL_STAGE'): Promise<string[]> => {
    const targetId = randomUUID();
    await env.ds.transaction((m) =>
      enqueueInbox(m, {
        entId: ENT,
        actorId,
        type: type as 'CSL_STAGE',
        targetId,
      }),
    );
    const rows = await env.ds.query<{ r: string[] }[]>(
      `SELECT nob_recipients AS r FROM amb_acm_notification_outbox WHERE nob_target_id=$1`,
      [targetId],
    );
    return rows[0]?.r ?? [];
  };

  beforeAll(async () => {
    env = await bootAcmTestEnv();
    svc = env.app.get(NotificationSettingsService, { strict: false });
    await env.ds.query(
      `UPDATE amb_acm_user SET usr_status='INACTIVE' WHERE ent_id=$1`,
      [ENT],
    );
    actorId = await addUser('actor@notify.test', 'ADMIN');
    adminId = await addUser('admin@notify.test', 'ADMIN');
    staffId = await addUser('staff@notify.test', 'STAFF');
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  it('keeps current behaviour without settings', async () => {
    expect((await recipients()).sort()).toEqual([adminId, staffId].sort());
    const view = await svc.getTenant(ENT);
    expect(view.config.types.CSL_STAGE).toMatchObject({
      inbox: true,
      push: true,
    });
    expect(view.config.reminder).toEqual({ first: 5, second: 10 });
  });

  it('narrows recipients by role and turns a situation off', async () => {
    await svc.putTenant(ENT, actorId, {
      types: { CSL_STAGE: { roles: ['ADMIN'] }, CSL_CREATED: { inbox: false } },
    });
    expect(await recipients('CSL_STAGE')).toEqual([adminId]);
    expect(await recipients('CSL_CREATED')).toEqual([]);
    // 받는 역할을 넓힐 수는 없다(상담은 강사 제외)
    const saved = await svc.putTenant(ENT, actorId, {
      types: { CSL_STAGE: { roles: ['ADMIN', 'STAFF', 'TEACHER'] } },
    });
    expect(saved.config.types.CSL_STAGE.roles).toEqual(['ADMIN', 'STAFF']);
  });

  it('drops a person who turned the inbox off for that situation', async () => {
    await svc.putPersonal(
      { entId: ENT, id: staffId },
      { types: { CSL_STAGE: { inbox: false } } },
    );
    expect(await recipients('CSL_STAGE')).toEqual([adminId]);
    const mine = await svc.getPersonal({ entId: ENT, id: staffId });
    expect(mine.prefs.types.CSL_STAGE).toEqual({ inbox: false });
    expect(mine.types).not.toContain('MAP_APPLY');
  });

  it('rejects invalid reminder hours and quiet hours', async () => {
    await expect(
      svc.putTenant(ENT, actorId, { reminder: { first: 10, second: 5 } }),
    ).rejects.toMatchObject({
      response: { message: 'INVALID_REMINDER_HOURS' },
    });
    await expect(
      svc.putTenant(ENT, actorId, {
        push: { quiet: { on: true, start: '25:00', end: '08:00' } },
      }),
    ).rejects.toMatchObject({ response: { message: 'INVALID_QUIET_HOURS' } });
    const ok = await svc.putTenant(ENT, actorId, {
      reminder: { first: 3, second: 6 },
      push: {
        enabled: true,
        chatPreview: false,
        quiet: { on: true, start: '22:00', end: '07:00' },
      },
    });
    expect(ok.config.reminder).toEqual({ first: 3, second: 6 });
    expect(ok.config.push).toEqual({
      enabled: true,
      chatPreview: false,
      quiet: { on: true, start: '22:00', end: '07:00' },
    });
  });

  it('reports device push status by device type', async () => {
    await env.ds.query(
      `INSERT INTO amb_acm_push_subscription(ent_id,psu_kind,psu_recipient_id,psu_endpoint_hash,psu_subscription,psu_device)
       VALUES ($1,'USER',$2,'h1','{}','MOBILE'),($1,'USER',$2,'h2','{}','DESKTOP'),($1,'USER',$2,'h3','{}',NULL)`,
      [ENT, adminId],
    );
    const s = await svc.pushStatus(ENT);
    expect(s.devices).toEqual({ mobile: 1, desktop: 1, unknown: 1 });
    expect(s.last7days).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });
});
