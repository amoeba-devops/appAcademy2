import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AesGcmService } from '../../../src/modules/acm-common/crypto/aes-gcm.service';
import { AuditService } from '../../../src/modules/acm-audit/application/audit.service';
import { AuditLogTypeormEntity } from '../../../src/modules/acm-audit/infrastructure/typeorm/audit-log.typeorm-entity';
import { GoogleAppConfigService } from '../../../src/modules/acm-prj/application/google-app-config.service';
import { DriveClient } from '../../../src/modules/acm-prj/infrastructure/drive.client';

// REQ-261016B — 시스템 설정 Google OAuth 앱: 저장값 우선·Secret 비노출·초기화 시 환경변수 복귀.
const sql = (f: string) =>
  readFileSync(resolve(__dirname, '../../../../sql/acm', f), 'utf8');

describe('system Google OAuth app settings (PostgreSQL)', () => {
  let pg: StartedPostgreSqlContainer;
  let ds: DataSource;
  let svc: GoogleAppConfigService;
  let client: DriveClient;
  const admin = randomUUID();
  const input = {
    clientId: '123456789012-abcdefghijklmnop.apps.googleusercontent.com',
    clientSecret: 'GOCSPX-system-secret-value',
    redirectUri: 'https://acm.amoeba.site/api/acm/prj/drive/callback',
    pickerKey: 'AIza' + 'b'.repeat(35),
    projectNumber: '123456789012',
  };

  beforeAll(async () => {
    pg = await new PostgreSqlContainer(
      process.env.ACM_TEST_PG_IMAGE ?? 'tac-postgres-acm:pg16-bigm',
    )
      .withDatabase('sga_test')
      .withUsername('sga_test')
      .withPassword('sga_test')
      .withPullPolicy({ shouldPull: () => false })
      .start();
    ds = await new DataSource({
      type: 'postgres',
      host: pg.getHost(),
      port: pg.getPort(),
      username: pg.getUsername(),
      password: pg.getPassword(),
      database: pg.getDatabase(),
      entities: [AuditLogTypeormEntity],
      synchronize: false,
    }).initialize();
    await ds.query(`CREATE FUNCTION set_acm_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
      CREATE TABLE amb_acm_user(usr_id uuid PRIMARY KEY, usr_email text);`);
    await ds.query(sql('965-acm-audit-log.sql'));
    await ds.query(sql('1039-sys-google-app.sql'));
    await ds.query(sql('1039-sys-google-app.sql'));
    await ds.query(`INSERT INTO amb_acm_user VALUES($1,'admin@amoeba.group')`, [
      admin,
    ]);
    svc = new GoogleAppConfigService(
      ds,
      new AesGcmService(new ConfigService({ ACM_PII_KEY: 'cd'.repeat(32) })),
      new ConfigService({
        ACM_GOOGLE_CLIENT_ID: 'env-client.apps.googleusercontent.com',
        ACM_GOOGLE_CLIENT_SECRET: 'env-secret',
        ACM_GOOGLE_REDIRECT_URI:
          'https://env.example/api/acm/prj/drive/callback',
      }),
      new AuditService(ds.getRepository(AuditLogTypeormEntity)),
    );
    await svc.reload();
    client = new DriveClient(svc);
  }, 120_000);

  afterAll(async () => {
    svc?.onModuleDestroy();
    if (ds?.isInitialized) await ds.destroy();
    if (pg) await pg.stop();
  });

  it('falls back to env values when nothing is saved', () => {
    expect(svc.source()).toBe('ENV');
    expect(client.setting('CLIENT_ID')).toBe(
      'env-client.apps.googleusercontent.com',
    );
    expect(client.ready()).toBe(true);
  });

  it('saved values take effect immediately; secret is encrypted and never returned', async () => {
    const view = await svc.save(input, admin);
    expect(view).toMatchObject({
      source: 'SYSTEM',
      clientId: input.clientId,
      hasSecret: true,
      projectNumber: '123456789012',
      updatedBy: 'admin@amoeba.group',
    });
    expect(JSON.stringify(view)).not.toContain('system-secret');
    expect(view.pickerKeyMasked).not.toContain('b'.repeat(35));
    expect(client.setting('CLIENT_SECRET')).toBe(input.clientSecret);
    expect(client.setting('REDIRECT_URI')).toBe(input.redirectUri);
    const [row] = await ds.query(`SELECT * FROM amb_acm_sys_google_app`);
    expect(row.sga_secret_encrypted.toString()).not.toContain('system-secret');
    const audits = await ds.query(
      `SELECT adl_action, adl_field_name, adl_old_value, adl_new_value FROM amb_acm_audit_log`,
    );
    expect(audits[0]).toMatchObject({
      adl_action: 'CREATE',
      adl_old_value: null,
      adl_new_value: null,
    });
  });

  it('blank secret and picker key keep stored values', async () => {
    await svc.save(
      { ...input, clientSecret: '', pickerKey: '', projectNumber: '999999999' },
      admin,
    );
    expect(client.setting('CLIENT_SECRET')).toBe(input.clientSecret);
    expect(client.setting('PICKER_KEY')).toBe(input.pickerKey);
    expect(client.setting('PROJECT_NUMBER')).toBe('999999999');
    const [last] = await ds.query(
      `SELECT adl_field_name FROM amb_acm_audit_log ORDER BY created_at DESC LIMIT 1`,
    );
    expect(last.adl_field_name).toBe('projectNumber');
  });

  it('rejects malformed input without changing stored values', async () => {
    await expect(
      svc.save({ ...input, clientId: 'bad' }, admin),
    ).rejects.toThrow();
    expect(client.setting('CLIENT_ID')).toBe(input.clientId);
  });

  it('clearing falls back to env values', async () => {
    const view = await svc.clear(admin);
    expect(view.source).toBe('ENV');
    expect(client.setting('CLIENT_ID')).toBe(
      'env-client.apps.googleusercontent.com',
    );
  });
});
