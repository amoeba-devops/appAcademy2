import { RegisteredUserService } from '../../../src/modules/acm-system/application/registered-user.service';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261018B — 등록 사용자 목록: 콘솔(관리자·직원·강사) + 로그인 계정이 발급된 포털 학생·강사.
 * 학부모·시스템 관리자·다른 테넌트·계정 없는 학생은 빠진다.
 */
describe('IT-REGISTERED-USERS', () => {
  let env: AcmTestEnv;
  let svc: RegisteredUserService;
  const ENT = '00000000-0000-0000-0000-000000000001';
  const OTHER = '99999999-9999-4999-8999-999999999999';

  beforeAll(async () => {
    env = await bootAcmTestEnv();
    svc = new RegisteredUserService(env.ds);
    const q = (sql: string, p: unknown[] = []) => env.ds.query(sql, p);
    await q(`DELETE FROM amb_acm_portal_account`);
    await q(
      `INSERT INTO amb_acm_user (ent_id, usr_email, usr_name, usr_status, usr_role) VALUES
        ($1,'staff1@tpi.co.kr','직원 하나','ACTIVE','STAFF'),
        ($1,'teach1@tpi.co.kr','강사 하나','ACTIVE','TEACHER'),
        ($2,'other@x.com','다른 테넌트','ACTIVE','ADMIN')`,
      [ENT, OTHER],
    );
    const [{ usr_id }] = await q(
      `SELECT usr_id FROM amb_acm_user WHERE usr_email='teach1@tpi.co.kr'`,
    );
    const [{ tch_id }] = await q(
      `INSERT INTO amb_acm_tch_teacher (ent_id, tch_name, tch_email, tch_user_id) VALUES ($1,'강사 하나','teach1@tpi.co.kr',$2) RETURNING tch_id`,
      [ENT, usr_id],
    );
    const [{ std_id }] = await q(
      `INSERT INTO amb_acm_std_student (ent_id, std_name) VALUES ($1,'학생 하나') RETURNING std_id`,
      [ENT],
    );
    await q(
      `INSERT INTO amb_acm_std_student (ent_id, std_name) VALUES ($1,'계정 없는 학생')`,
      [ENT],
    );
    await q(
      `INSERT INTO amb_acm_portal_account (ent_id, pac_kind, pac_ref_id, pac_login_id, pac_password_hash, pac_locked_at) VALUES
        ($1,'STUDENT',$2,'stu1@gmail.com','x', now()),
        ($1,'TEACHER',$3,'teach1@tpi.co.kr','x', NULL),
        ($1,'PARENT',$2,'parent1@gmail.com','x', NULL)`,
      [ENT, std_id, tch_id],
    );
    await q(
      `INSERT INTO amb_acm_user_permission (ent_id, usr_id, upr_permission)
       SELECT ent_id, usr_id, 'TENANT_MASTER' FROM amb_acm_user WHERE usr_email='admin@tpi.co.kr' ON CONFLICT DO NOTHING`,
    );
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  it('lists console and portal users of the tenant with counts', async () => {
    const r = await svc.list(ENT);
    const ids = r.users.map((u) => `${u.type}:${u.source}:${u.login_id}`);
    expect(ids).toEqual(
      expect.arrayContaining([
        'ADMIN:CONSOLE:admin@tpi.co.kr',
        'STAFF:CONSOLE:staff1@tpi.co.kr',
        'TEACHER:CONSOLE:teach1@tpi.co.kr',
        'TEACHER:PORTAL:teach1@tpi.co.kr',
        'STUDENT:PORTAL:stu1@gmail.com',
      ]),
    );
    expect(ids.join()).not.toContain('parent1');
    expect(ids.join()).not.toContain('other@x.com');
    expect(r.users.some((u) => u.name === '계정 없는 학생')).toBe(false);
    expect(r.counts).toMatchObject({ TEACHER: 2, STUDENT: 1, STAFF: 1 });
    expect(r.counts.ALL).toBe(r.users.length);
    const admin = r.users.find((u) => u.login_id === 'admin@tpi.co.kr');
    expect(admin?.permissions).toContain('TENANT_MASTER');
    const stu = r.users.find((u) => u.type === 'STUDENT');
    expect(stu).toMatchObject({
      name: '학생 하나',
      locked: true,
      auth_source: 'portal',
    });
    expect(JSON.stringify(r)).not.toMatch(/password|hash/i);
  });

  it('filters by type and searches name or login id (wildcards are literal)', async () => {
    const t = await svc.list(ENT, 'TEACHER');
    expect(t.users.map((u) => u.source).sort()).toEqual(['CONSOLE', 'PORTAL']);
    expect(t.users[0].ref_id).toBeTruthy();
    expect(
      (await svc.list(ENT, 'ALL', '학생')).users.map((u) => u.login_id),
    ).toEqual(['stu1@gmail.com']);
    expect((await svc.list(ENT, 'ALL', 'STAFF1@')).users).toHaveLength(1);
    expect((await svc.list(ENT, 'ALL', '%')).users).toHaveLength(0);
  });
});
