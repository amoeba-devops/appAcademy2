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

const SQL_PATH = path.resolve(__dirname, '../../../../sql/acm/100-acm-v1.0a-init.sql');

export async function bootAcmTestEnv(): Promise<AcmTestEnv> {
  const pg = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('db_amb_test')
    .withUsername('amb')
    .withPassword('amb')
    .start();

  process.env.ACM_PII_KEY = '0'.repeat(64); // 32 bytes hex
  process.env.NODE_ENV = 'test';

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
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
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
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

  const ds = app.get(DataSource);
  if (fs.existsSync(SQL_PATH)) {
    const sql = fs.readFileSync(SQL_PATH, 'utf8');
    await ds.query(sql);
  } else {
    throw new Error(`Missing SQL: ${SQL_PATH}`);
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
