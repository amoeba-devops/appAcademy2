import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DataSource } from 'typeorm';
import { AcmCommonModule } from '../../../src/modules/acm-common/acm-common.module';
import { AcmCslModule } from '../../../src/modules/acm-csl/acm-csl.module';
import { AcmSchModule } from '../../../src/modules/acm-sch/acm-sch.module';
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

/** SQL files to run in order (schema only — skip seeds). */
const ACM_SQL_FILES = [
  '100-acm-v1.0a-init.sql',
  '300-acm-cls-v1.0b.sql',
  '400-acm-v1.0a-sch-p1.sql',
  '410-acm-v1.0a-qna-p1.sql',
  '420-acm-qna-i18n-labels.sql',
];

export async function bootAcmTestEnv(): Promise<AcmTestEnv> {
  const pg = await new PostgreSqlContainer(PG_IMAGE)
    .withDatabase('db_amb_test')
    .withUsername('amb')
    .withPassword('amb')
    .withPullPolicy(NEVER_PULL)
    .start();

  process.env.ACM_PII_KEY = '0'.repeat(64); // 32 bytes hex
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
      AcmCommonModule,
      AcmSchModule,
      AcmRefModule,
      AcmCslModule,
      AcmQnaModule,
      AcmDshModule,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  // Note: forbidNonWhitelisted=false because OwnEntityGuard injects `entId` into req.body
  // which would otherwise fail strict validation. `whitelist=true` still strips unknowns.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }));
  app.setGlobalPrefix('api');
  // Test auth: inject req.user from x-test-user/x-test-ent/x-test-roles headers
  app.use((req: any, _res: any, next: any) => {
    const id = req.headers['x-test-user'];
    const entId = req.headers['x-test-ent'];
    const roles = (req.headers['x-test-roles'] as string | undefined)?.split(',') ?? [];
    if (id && entId) req.user = { id, entId, roles };
    next();
  });
  await app.init();

  const ds = app.get<DataSource>('acm-pgDataSource');
  for (const f of ACM_SQL_FILES) {
    const p = path.resolve(SQL_DIR, f);
    if (!fs.existsSync(p)) throw new Error(`Missing SQL: ${p}`);
    const sql = fs.readFileSync(p, 'utf8');
    await ds.query(sql);
  }

  return { app, pg, ds };
}

export async function teardownAcmTestEnv(env: AcmTestEnv) {
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
