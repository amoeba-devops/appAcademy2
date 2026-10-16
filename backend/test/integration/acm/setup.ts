import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DataSource } from 'typeorm';
import { MailerModule } from '../../../src/infrastructure/mailer/mailer.module';
import { AcmCommonModule } from '../../../src/modules/acm-common/acm-common.module';
import { AcmAuthModule } from '../../../src/modules/acm-auth/acm-auth.module';
import { AcmJwtAuthGuard } from '../../../src/modules/acm-auth/guards/acm-jwt-auth.guard';
import { AMA_PLATFORM_CLIENT } from '../../../src/modules/acm-auth/infrastructure/ama-platform.client';
import { AcmCslModule } from '../../../src/modules/acm-csl/acm-csl.module';
import { AcmSchModule } from '../../../src/modules/acm-sch/acm-sch.module';
import { AcmMapModule } from '../../../src/modules/acm-map/acm-map.module';
import { AcmRefModule } from '../../../src/modules/acm-ref/acm-ref.module';
import { AcmQnaModule } from '../../../src/modules/acm-qna/acm-qna.module';
import { AcmDshModule } from '../../../src/modules/acm-dsh/acm-dsh.module';

export interface AcmTestEnv {
  app: INestApplication;
  pg: StartedPostgreSqlContainer;
  ds: DataSource;
}

const SQL_DIR = path.resolve(__dirname, '../../../../sql/acm');
const PG_IMAGE = process.env.ACM_TEST_PG_IMAGE ?? 'tac-postgres-acm:pg16-bigm';
/** Never-pull policy: assume image is built locally (`docker compose build postgres`). */
const NEVER_PULL = { shouldPull: () => false };

/**
 * REQ-261017 — 배포와 같은 순서(scripts/acm-migration-order.sh: 버전 순 + 의존 역순 3개 명시 배치)로
 * sql/acm 전체를 적용한다. 손으로 관리하던 목록이 새 마이그레이션을 놓치던 문제를 없앤다.
 */
export function acmSqlFiles(): string[] {
  const script = path.resolve(
    __dirname,
    '../../../../scripts/acm-migration-order.sh',
  );
  return execFileSync('bash', [script, SQL_DIR], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((p) => path.basename(p));
}
/** psql 전용 메타 명령(`\\set ON_ERROR_STOP on` 등)은 드라이버로 실행할 수 없어 뺀다. */
const readSql = (f: string) =>
  fs.readFileSync(path.resolve(SQL_DIR, f), 'utf8').replace(/^\s*\\.*$/gm, '');
export async function applyAcmMigrations(ds: DataSource): Promise<void> {
  // 한 연결에서 순서대로 적용. 실패하면 파일 이름과 함께 바로 알린다(순서 문제를 숨기지 않는다).
  const qr = ds.createQueryRunner();
  await qr.connect();
  try {
    for (const f of acmSqlFiles()) {
      try {
        await qr.query(readSql(f));
      } catch (e) {
        await qr.query('ROLLBACK').catch(() => undefined);
        throw new Error(`Migration ${f} failed: ${(e as Error).message}`, {
          cause: e,
        });
      }
    }
  } finally {
    await qr.release();
  }
}

/**
 * REQ-260609B — entityIds exercised by the happy-path AMA-exchange tests.
 * Under the deny-all gate, each must have an active amb_acm_ama_config row
 * (appCode 'tpi-acm') or login is rejected. Seeded after schema load below.
 */
const TEST_ALLOWED_ENTITY_IDS = [
  '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b', // default token entityId
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666',
  '88888888-8888-8888-8888-888888888888',
  '99999999-aaaa-bbbb-cccc-dddddddddddd',
];

export async function bootAcmTestEnv(): Promise<AcmTestEnv> {
  const pg = await new PostgreSqlContainer(PG_IMAGE)
    .withDatabase('db_amb_test')
    .withUsername('amb')
    .withPassword('amb')
    .withPullPolicy(NEVER_PULL)
    .start();

  process.env.ACM_PII_KEY = '0'.repeat(64); // 32 bytes hex
  process.env.ACM_JWT_SECRET = 'acm-test-secret';
  process.env.AMA_JWT_SECRET = 'dev-acm-ama-secret-change-me-32bytes-for-tests';
  process.env.AMA_JWT_ALLOWED_APP_CODES = 'tpi-acm';
  process.env.NODE_ENV = 'test';

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        name: 'acm-pg',
        type: 'postgres',
        host: pg.getHost(),
        port: pg.getPort(),
        username: pg.getUsername(),
        password: pg.getPassword(),
        database: pg.getDatabase(),
        autoLoadEntities: true,
        synchronize: false,
      }),
      MailerModule,
      AcmCommonModule,
      AcmAuthModule,
      AcmSchModule,
      AcmMapModule,
      AcmRefModule,
      AcmCslModule,
      AcmQnaModule,
      AcmDshModule,
    ],
  })
    // Bypass JWT guard in tests; req.user is injected by middleware below.
    .overrideGuard(AcmJwtAuthGuard)
    .useValue({ canActivate: () => true })
    // REQ-260604 이후 AMA 로그인은 법인 소속 확인을 거친다. 목 클라이언트는 고정 사용자만 알므로
    // 테스트 토큰의 임의 사용자도 소속으로 본다(소속 판정 자체는 단위 테스트가 다룬다).
    .overrideProvider(AMA_PLATFORM_CLIENT)
    .useValue({
      assertMember: (entityId: string, userId: string) =>
        Promise.resolve({
          userId,
          entityId,
          level: 'MEMBER',
          name: 'IT user',
          email: '',
        }),
      searchUsers: () => Promise.resolve([]),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  // Note: forbidNonWhitelisted=false because OwnEntityGuard injects `entId` into req.body
  // which would otherwise fail strict validation. `whitelist=true` still strips unknowns.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');
  // Test auth: inject req.user from x-test-user/x-test-ent/x-test-roles headers
  app.use((req: any, _res: any, next: any) => {
    const id = req.headers['x-test-user'];
    const entId = req.headers['x-test-ent'];
    const roles =
      (req.headers['x-test-roles'] as string | undefined)?.split(',') ?? [];
    const roleHeader = req.headers['x-test-role'];
    const role =
      typeof roleHeader === 'string' && roleHeader
        ? roleHeader
        : typeof roles[0] === 'string'
          ? roles[0].toUpperCase()
          : undefined;
    if (id && entId) req.user = { id, entId, roles, role };
    next();
  });
  await app.init();

  const ds = app.get<DataSource>('acm-pgDataSource');
  await applyAcmMigrations(ds);

  // REQ-260609B — seed AMA login-gate config for the test entityIds so the
  // deny-all gate (AmaConfigGateService) admits the happy-path tokens.
  for (const entId of TEST_ALLOWED_ENTITY_IDS) {
    await ds.query(
      `INSERT INTO amb_acm_ama_config (ent_id, amc_ama_entity_id, amc_app_code, amc_is_active)
         VALUES ($1::uuid, $2::varchar, 'tpi-acm', TRUE)
       ON CONFLICT (ent_id) DO NOTHING`,
      [entId, entId],
    );
  }

  return { app, pg, ds };
}

export async function teardownAcmTestEnv(env?: AcmTestEnv) {
  if (!env) return;
  await env.app.close();
  await env.pg.stop();
}

export const TEST_ENT_ID = '00000000-0000-4000-8000-000000000001';
export const TEST_USER_ID = '00000000-0000-4000-8000-0000000000aa';
export const TEST_ADMIN_ID = '00000000-0000-4000-8000-0000000000bb';

/**
 * Mock JWT auth — bypass guard by injecting req.user via a header parser middleware.
 * Tests should send `x-test-user` and `x-test-ent` headers.
 */
