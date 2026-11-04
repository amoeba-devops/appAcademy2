import { randomUUID } from 'crypto';
import { StudentDeletionService } from '../../../src/modules/acm-std/application/student-deletion.service';
import type { AcmCurrentUser } from '../../../src/modules/acm-common/decorators/current-user.decorator';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261104 — 비활성화 학생 다시 활성화: 상태·배정 보존, 이력 RESTORE, 권한, 재실행 안전.
 */
describe('IT-STD-REACTIVATE', () => {
  let env: AcmTestEnv;
  let svc: StudentDeletionService;
  const ENT = '00000000-0000-4000-8000-000000261104';
  const [master, plain, std, tch] = Array.from({ length: 4 }, () =>
    randomUUID(),
  );
  const as = (id: string) => ({ id, entId: ENT }) as AcmCurrentUser;

  beforeAll(async () => {
    env = await bootAcmTestEnv();
    svc = new StudentDeletionService(env.ds);
    await env.ds.query(
      `INSERT INTO amb_acm_user (usr_id, ent_id, usr_email, usr_name, usr_status, usr_role)
       VALUES ($1,$3,'master@re.test','마스터','ACTIVE','ADMIN'), ($2,$3,'plain@re.test','일반','ACTIVE','ADMIN')`,
      [master, plain, ENT],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_user_permission (ent_id, usr_id, upr_permission) VALUES ($1,$2,'TENANT_MASTER')`,
      [ENT, master],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_tch_teacher (tch_id, ent_id, tch_name, tch_email) VALUES ($1,$2,'정강사','t@re.test')`,
      [tch, ENT],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_status, std_site)
       VALUES ($1,$2,'김복구','WITHDRAWN','TPI')`,
      [std, ENT],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_std_student_teacher (ent_id, std_id, tch_id, st_sort_order) VALUES ($1,$2,$3,0)`,
      [ENT, std, tch],
    );
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  const row = async () =>
    (
      await env.ds.query(
        `SELECT std_status, std_archived_at, std_archived_by, deleted_at,
                (SELECT count(*)::int FROM amb_acm_std_student_teacher st WHERE st.std_id = s.std_id) AS teachers
           FROM amb_acm_std_student s WHERE std_id = $1`,
        [std],
      )
    )[0];

  it('restores an archived student as it was', async () => {
    await svc.archive(as(master), std);
    expect((await svc.list(as(master), 1)).items.map((r) => r.id)).toEqual([
      std,
    ]);
    await expect(svc.restore(as(master), std)).resolves.toEqual({ id: std });
    expect(await row()).toMatchObject({
      std_status: 'WITHDRAWN',
      std_archived_at: null,
      std_archived_by: null,
      deleted_at: null,
      teachers: 1,
    });
    expect((await svc.list(as(master), 1)).items).toEqual([]);
    const history = await svc.list(as(master), 1, true);
    expect(history.items.map((r) => r.action)).toEqual(['RESTORE', 'ARCHIVE']);
    expect(history.items[0].actorName).toBe('마스터');
  });

  it('is safe to repeat and needs the delete permission', async () => {
    await expect(svc.restore(as(master), std)).resolves.toEqual({ id: std });
    expect((await svc.list(as(master), 1, true)).total).toBe(2);
    await svc.archive(as(master), std);
    await expect(svc.restore(as(plain), std)).rejects.toThrow(
      'DELETE_PERMISSION_REQUIRED',
    );
    await expect(
      svc.restore({ id: master, entId: randomUUID() } as AcmCurrentUser, std),
    ).rejects.toThrow();
    expect((await row()).std_archived_at).not.toBeNull();
  });
});
