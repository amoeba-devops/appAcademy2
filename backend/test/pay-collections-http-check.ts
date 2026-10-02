import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { CollectionsController } from '../src/modules/acm-pay/presentation/collections.controller';
import { CollectionsService } from '../src/modules/acm-pay/application/collections.service';
import { TenantSettingsService } from '../src/modules/acm-system/application/tenant-settings.service';
import { AcmJwtAuthGuard } from '../src/modules/acm-auth/guards/acm-jwt-auth.guard';
import { RolesGuard } from '../src/modules/acm-common/guards/roles.guard';
import * as XLSX from 'xlsx';
config({ path: process.env.ACM_TEST_ENV_FILE ?? '.env', quiet: true });
async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 5434,
    username: process.env.ACM_PG_USER || 'acm',
    password: process.env.ACM_PG_PASSWORD || 'acm',
    database: 'acm_lifecycle_test_260929',
  });
  await ds.initialize();
  await ds.query(readFileSync('../sql/acm/1026-pay-collections.sql', 'utf8'));
  await ds.query(readFileSync('../sql/acm/1027-pay-bill-drafts.sql', 'utf8'));
  const ent = randomUUID(),
    actor = randomUUID(),
    student = randomUUID(),
    second = randomUUID();
  const user = {
    id: actor,
    entId: ent,
    role: 'ADMIN',
    name: '수납 테스트 관리자',
    email: 'payment-test@example.invalid',
    authSource: 'local',
  };
  await ds.query(
    "INSERT INTO amb_acm_std_student(std_id,ent_id,std_name,std_site,std_status) VALUES($1,$2,'예시 학생 A','TPI','ACTIVE'),($3,$2,'예시 학생 B','TRINITY','ACTIVE')",
    [student, ent, second],
  );
  await ds.query(
    "INSERT INTO amb_acm_user(usr_id,ent_id,usr_name,usr_email,usr_role,usr_status) VALUES($1,$2,$3,$4,'ADMIN','ACTIVE')",
    [actor, ent, user.name, user.email],
  );
  const svc = new CollectionsService(ds, {
    getTimezone: async () => 'Asia/Seoul',
  } as unknown as TenantSettingsService);
  const mod = await Test.createTestingModule({
    controllers: [CollectionsController],
    providers: [{ provide: CollectionsService, useValue: svc }, RolesGuard],
  })
    .overrideGuard(AcmJwtAuthGuard)
    .useValue({
      canActivate(ctx: ExecutionContext) {
        const req = ctx
          .switchToHttp()
          .getRequest<Request & { user: typeof user }>();
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (
          !['fixture-admin', 'fixture-staff', 'fixture-teacher'].includes(
            token || '',
          )
        )
          return false;
        req.user = {
          ...user,
          role:
            token === 'fixture-staff'
              ? 'STAFF'
              : token === 'fixture-teacher'
                ? 'TEACHER'
                : 'ADMIN',
        };
        return true;
      },
    })
    .compile();
  const app = mod.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    const p = req.path;
    if (p.startsWith('/api/acm/pay/')) return next();
    if (p.endsWith('/events')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write('data: {}\n\n');
      return;
    }
    if (p === '/api/acm/auth/login')
      return res.json({ accessToken: 'fixture-admin', user });
    if (p === '/api/acm/auth/me') return res.json({ user });
    if (p.includes('/menus')) return res.json({ hidden: [], order: [] });
    if (p.endsWith('/inbox/count'))
      return res.json({ unreadCount: 0, asOf: new Date().toISOString() });
    if (p.includes('/talk/channels')) return res.json([]);
    return res.json({});
  });
  await app.listen(4009, '127.0.0.1');
  const api = async (
    path: string,
    method = 'GET',
    body?: unknown,
    token = 'fixture-admin',
  ) =>
    fetch('http://127.0.0.1:4009/api/acm/pay/bills' + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const cleanup = async () => {
    await app.close();
    for (const table of [
      'amb_acm_pay_bill_audit',
      'amb_acm_pay_bill_adjustment',
      'amb_acm_pay_collection',
      'amb_acm_pay_request',
      'amb_acm_pay_bill',
      'amb_acm_std_student',
      'amb_acm_user',
    ])
      await ds.query(`DELETE FROM ${table} WHERE ent_id=$1`, [ent]);
    await ds.destroy();
  };
  try {
    assert.equal(
      (await api('', 'GET', undefined, 'fixture-teacher')).status,
      403,
    );
    assert.equal(
      (
        await api('/batch-create', 'POST', {
          requestId: randomUUID(),
          items: [{ studentId: student }],
        })
      ).status,
      400,
    );
    const body = {
      requestId: randomUUID(),
      items: [
        {
          studentId: student,
          month: new Date().toISOString().slice(0, 7),
          due: '2026-10-05',
          kind: 'CLASS',
          title: '영어 수업',
          amount: 300000,
          discount: 20000,
          memo: '=not-a-formula',
        },
      ],
    };
    const r = await api('/batch-create', 'POST', body);
    assert.equal(r.status, 201);
    const result = (await r.json()) as { ids: string[] };
    const id = result.ids[0];
    const payment = {
      requestId: randomUUID(),
      version: 1,
      amount: 100000,
      date: '2026-10-01',
      method: 'TRANSFER',
      reason: '검증용 첫 납부',
    };
    assert.equal(
      (await api('/' + id + '/collections', 'POST', payment, 'fixture-staff'))
        .status,
      201,
    );
    assert.equal(
      (await api('/' + id + '/refunds', 'POST', {}, 'fixture-staff')).status,
      403,
    );
    const list = (await (await api('')).json()) as {
      items: { unpaid: number }[];
    };
    assert.equal(list.items[0].unpaid, 180000);
    const exportRes = await api('/export');
    assert.equal(exportRes.status, 200);
    const book = XLSX.read(Buffer.from(await exportRes.arrayBuffer()), {
      type: 'buffer',
    });
    const cells = Object.values(book.Sheets.Collections) as XLSX.CellObject[];
    assert(cells.some((c) => c.v === '=not-a-formula' && c.t === 's' && !c.f));
    const draftBatch = {
      requestId: randomUUID(),
      month: '2031-10',
      title: 'HTTP drafts',
    };
    assert.equal(
      (await api('/active-drafts', 'POST', draftBatch, 'fixture-teacher'))
        .status,
      403,
    );
    assert.equal(
      (await api('/active-drafts', 'POST', { ...draftBatch, month: 'bad' }))
        .status,
      400,
    );
    assert.equal(
      (await api('/active-drafts', 'POST', draftBatch, 'fixture-staff')).status,
      201,
    );
    const draftList = (await (
      await api('?from=2031-10&to=2031-10')
    ).json()) as {
      items: { id: string; amount: null; due: null; unpaid: null }[];
      summary: { drafts: number; net: number };
    };
    assert.equal(draftList.summary.drafts, 2);
    assert.equal(draftList.summary.net, 0);
    assert.equal(draftList.items[0].amount, null);
    assert.equal(draftList.items[0].due, null);
    assert.equal(draftList.items[0].unpaid, null);
    assert.equal(
      (
        await api('/' + draftList.items[0].id + '/collections', 'POST', {
          ...payment,
          requestId: randomUUID(),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api('/batch', 'PATCH', {
          requestId: randomUUID(),
          reason: 'Invalid empty amount',
          items: [
            {
              id: draftList.items[0].id,
              version: 1,
              amount: null,
              discount: 0,
              due: '2031-10-20',
              title: 'HTTP draft',
              memo: '',
            },
          ],
        })
      ).status,
      400,
    );
    const draftExport = await api('/export?from=2031-10&to=2031-10');
    const draftBook = XLSX.read(Buffer.from(await draftExport.arrayBuffer()), {
      type: 'buffer',
    });
    const exportedDrafts = XLSX.utils.sheet_to_json<{
      Amount?: number;
      Status: string;
    }>(draftBook.Sheets.Collections);
    assert.equal(exportedDrafts.length, 2);
    assert(
      exportedDrafts.every(
        (d) => d.Amount === undefined && d.Status === 'DRAFT',
      ),
    );
    console.log(
      'PASS: actual Nest HTTP DTO validation, teacher rejection, STAFF payment/admin-only refund, persisted balance, draft permissions/NULL/payment block and XLSX blank/safe cells',
    );
  } catch (e) {
    await cleanup();
    throw e;
  }
  if (process.env.PAY_UI_FIXTURE === '1') {
    console.log(
      'UI READY: synthetic data only; fixture login payment-test@example.invalid / any test password',
    );
    process.once('SIGINT', () => {
      void cleanup().then(() => process.exit(0));
    });
    process.once('SIGTERM', () => {
      void cleanup().then(() => process.exit(0));
    });
  } else await cleanup();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
