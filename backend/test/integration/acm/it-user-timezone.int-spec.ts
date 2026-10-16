import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { PortalMeController } from '../../../src/modules/acm-auth/presentation/portal-me.controller';
import { MeProfileController } from '../../../src/modules/acm-system/presentation/me-profile.controller';
import { AesGcmService } from '../../../src/modules/acm-common/crypto/aes-gcm.service';
import { ConfigService } from '@nestjs/config';
import type { PortalAuthUser } from '../../../src/modules/acm-auth/application/portal-account.service';
import type { AcmCurrentUser } from '../../../src/modules/acm-common/decorators/current-user.decorator';

// REQ-261015C WP5 — 사용자 타임존(포털·콘솔). NULL = 테넌트 기본.
describe('user timezone profile (PostgreSQL)', () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  const crypto = new AesGcmService(
    new ConfigService({ ACM_PII_KEY: 'ab'.repeat(32) }),
  );
  const ent = randomUUID();
  const other = randomUUID();
  const std = randomUUID();
  const portal = {
    id: randomUUID(),
    entId: ent,
    kind: 'STUDENT',
    refId: std,
    loginId: 'kid@example.com',
    mustChangePassword: false,
  } as PortalAuthUser;
  const consoleUser = {
    id: randomUUID(),
    entId: ent,
    role: 'TEACHER',
  } as AcmCurrentUser;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    ds = await new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
    }).initialize();
    await ds.query(`
      CREATE TABLE amb_acm_tenant(tnt_ent_id uuid PRIMARY KEY, tnt_timezone varchar(64));
      CREATE TABLE amb_acm_portal_account(pac_id uuid PRIMARY KEY, ent_id uuid, pac_kind varchar(10), pac_ref_id uuid, pac_login_id varchar(200));
      CREATE TABLE amb_acm_user(usr_id uuid PRIMARY KEY, ent_id uuid, usr_email text, usr_name text, usr_role text,
        auth_source text DEFAULT 'local', usr_password_hash text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
        usr_emergency_name varchar(100), usr_emergency_relation varchar(50), usr_emergency_phone_encrypted bytea,
        usr_emergency_phone_iv bytea, usr_emergency_phone_auth_tag bytea, usr_bio varchar(1000));
      CREATE TABLE amb_acm_std_student(std_id uuid PRIMARY KEY, ent_id uuid, std_name text);
      CREATE TABLE amb_acm_tch_teacher(tch_id uuid PRIMARY KEY, ent_id uuid, tch_name text);`);
    const migration = readFileSync(
      resolve(__dirname, '../../../../sql/acm/1037-user-timezone.sql'),
      'utf8',
    );
    await ds.query(migration);
    await ds.query(migration);
    await ds.query(`INSERT INTO amb_acm_tenant VALUES($1,'Asia/Seoul')`, [ent]);
    await ds.query(`INSERT INTO amb_acm_std_student VALUES($1,$2,'홍길동')`, [
      std,
      ent,
    ]);
    await ds.query(
      `INSERT INTO amb_acm_portal_account VALUES($1,$2,'STUDENT',$3,'kid@example.com')`,
      [portal.id, ent, std],
    );
    await ds.query(
      `INSERT INTO amb_acm_user VALUES($1,$2,'t@example.com','강사','TEACHER')`,
      [consoleUser.id, ent],
    );
  }, 120_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  });

  it('portal: defaults to tenant timezone, saves and clears own timezone', async () => {
    const c = new PortalMeController(ds);
    expect(await c.get(portal)).toEqual({
      kind: 'STUDENT',
      loginId: 'kid@example.com',
      name: '홍길동',
      timezone: null,
      tenantTimezone: 'Asia/Seoul',
    });
    expect(
      (await c.update(portal, { timezone: 'Asia/Ho_Chi_Minh' })).timezone,
    ).toBe('Asia/Ho_Chi_Minh');
    await expect(c.update(portal, { timezone: 'Bad/Zone' })).rejects.toThrow();
    expect((await c.update(portal, { timezone: '' })).timezone).toBeNull();
    // 다른 테넌트로 위장한 토큰은 행을 바꾸지 못한다.
    await c.update({ ...portal, entId: other }, { timezone: 'UTC' });
    expect((await c.get(portal)).timezone).toBeNull();
  });

  it('REQ-261017 console: emergency contact (phone encrypted), bio, join date; omitted fields kept', async () => {
    const c = new MeProfileController(ds, crypto);
    await c.update(consoleUser, { timezone: 'UTC' });
    const saved = await c.update(consoleUser, {
      emergencyName: ' 홍부모 ',
      emergencyRelation: '배우자',
      emergencyPhone: '010-1234-5678',
      bio: '수학 담당',
    });
    expect(saved).toMatchObject({
      timezone: 'UTC', // 생략한 타임존은 유지
      emergencyName: '홍부모',
      emergencyRelation: '배우자',
      emergencyPhone: '010-1234-5678',
      bio: '수학 담당',
    });
    expect(saved.createdAt).toBeTruthy();
    const [row] = await ds.query<{ plain: boolean }[]>(
      `SELECT position('1234' in encode(usr_emergency_phone_encrypted,'escape')) > 0 AS plain FROM amb_acm_user WHERE usr_id=$1`,
      [consoleUser.id],
    );
    expect(row.plain).toBe(false); // 평문 저장 금지
    const cleared = await c.update(consoleUser, {
      emergencyPhone: '',
      bio: '  ',
    });
    expect(cleared).toMatchObject({
      emergencyPhone: null,
      bio: null,
      emergencyName: '홍부모',
    });
    await expect(
      new MeProfileController(ds, crypto).update(consoleUser, {
        timezone: 'UTC',
      }),
    ).resolves.toMatchObject({ timezone: 'UTC' });
    await c.update(consoleUser, { timezone: '' }); // 다음 테스트를 위해 원복
  });

  it('console: saves own timezone only', async () => {
    const c = new MeProfileController(ds, crypto);
    expect((await c.get(consoleUser)).timezone).toBeNull();
    const saved = await c.update(consoleUser, {
      timezone: 'America/New_York',
    });
    expect(saved).toMatchObject({
      name: '강사',
      timezone: 'America/New_York',
      tenantTimezone: 'Asia/Seoul',
    });
  });
});
