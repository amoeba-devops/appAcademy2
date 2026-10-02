import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { CollectionsService } from '../src/modules/acm-pay/application/collections.service';
import { TenantSettingsService } from '../src/modules/acm-system/application/tenant-settings.service';
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
  const ent = randomUUID(),
    u = { entId: ent, id: randomUUID(), role: 'ADMIN' as const };
  const svc = new CollectionsService(ds, {
    getTimezone: async () => 'Asia/Seoul',
  } as unknown as TenantSettingsService);
  const ids = new Map<string, string>();
  const add = async (
    name: string,
    admission: string | null,
    start: string | null,
    end: string | null = null,
    status = 'ACTIVE',
    site = 'TPI',
  ) => {
    const id = randomUUID();
    ids.set(name, id);
    await ds.query(
      'INSERT INTO amb_acm_std_student(std_id,ent_id,std_name,std_site,std_status,std_admission_date,std_start_date,std_end_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, ent, name, site, status, admission, start, end],
    );
    return id;
  };
  const period = async (
    id: string,
    start: string,
    end: string | null,
    site: string,
  ) =>
    ds.query(
      "INSERT INTO amb_acm_dsh_operating_period(ent_id,kind,subject_id,site,start_date,end_date,source_key) VALUES($1,'STUDENT',$2,$3,$4,$5,$6)",
      [ent, id, site, start, end, randomUUID()],
    );
  const bill = async (
    student: string,
    amount: number | null,
    month = '2026-10',
    site = 'TPI',
    state = amount === null ? 'DRAFT' : 'ACTIVE',
  ) => {
    const id = randomUUID();
    await ds.query(
      "INSERT INTO amb_acm_pay_bill(pbl_id,ent_id,std_id,pbl_site,pbl_month,pbl_due,pbl_kind,pbl_title,pbl_amount,pbl_status,pbl_source_key,created_by) VALUES($1,$2,$3,$4,$5,$6,'CLASS','Test',$7,$8,$9,$10)",
      [
        id,
        ent,
        student,
        site,
        month,
        amount === null ? null : month + '-20',
        amount,
        state,
        randomUUID(),
        u.id,
      ],
    );
    return id;
  };
  try {
    const a = await add('A', '2026-09-01', '2026-11-01'); // admission precedes scheduled class
    const b = await add(
      'B',
      '2026-10-31',
      '2026-10-31',
      '2026-11-01',
      'WITHDRAWN',
    );
    const c = await add(
      'C',
      '2026-09-01',
      '2026-09-01',
      '2026-10-01',
      'WITHDRAWN',
    );
    const d = await add('D', null, '2026-09-01');
    const e = await add(
      'E',
      '2026-09-01',
      '2026-09-01',
      null,
      'ACTIVE',
      'TRINITY',
    );
    await period(e, '2026-09-01', '2026-10-10', 'TPI');
    await period(e, '2026-10-10', null, 'TRINITY');
    const f = await add('F', '2026-01-01', '2026-01-01');
    await period(f, '2026-01-01', '2026-02-01', 'TPI');
    await period(f, '2026-11-01', null, 'TPI');
    await add('G', '2026-11-01', '2026-11-01');
    await add('H', '2026-09-01', '2026-09-01', null, 'WITHDRAWN');
    const n = await add('N', '2026-10-01', '2026-10-01');
    const aBill = await bill(a, 100);
    await bill(a, 200);
    await bill(a, null);
    await bill(b, 0);
    await bill(d, 50);
    await bill(e, null, '2026-10', 'TRINITY');
    await bill(f, 400);
    const cBill = await bill(c, 500, '2026-09');
    const payment = async (id: string, amount: number, date: string) =>
      ds.query(
        "INSERT INTO amb_acm_pay_collection(ent_id,pbl_id,pcl_type,pcl_amount,pcl_date,pcl_method,pcl_reason,created_by) VALUES($1,$2,'PAYMENT',$3,$4,'CASH','Test',$5) RETURNING pcl_id",
        [ent, id, amount, date, u.id],
      );
    const [pay] = await payment(aBill, 80, '2026-10-15');
    await payment(aBill, 20, '2026-11-01');
    await payment(cBill, 50, '2026-10-15');
    await ds.query(
      "INSERT INTO amb_acm_pay_collection(ent_id,pbl_id,pcl_type,pcl_amount,pcl_date,pcl_method,pcl_reason,created_by,pcl_original_id) VALUES($1,$2,'REFUND',10,'2026-10-20','CASH','Test',$3,$4)",
      [ent, aBill, u.id, pay.pcl_id],
    );
    const result = await svc.monthly(u, { month: '2026-10' });
    assert.deepEqual(
      result.items.map((r) => r.name),
      ['A', 'B', 'E', 'N'],
    );
    assert.equal(result.summary.enrolled, 4);
    assert.equal(result.summary.missing, 1);
    assert.equal(result.summary.draftStudents, 2);
    assert.equal(result.summary.drafts, 2);
    assert.equal(result.summary.net, 300);
    assert.equal(result.summary.received, 90);
    assert.equal(result.summary.unpaid, 210);
    assert.equal(result.summary.rate, 30);
    assert.equal(result.reviewCount, 2);
    assert.equal(result.ledger.net, 750);
    assert.equal(result.cash.paid, 130);
    assert.equal(result.cash.refunded, 10);
    assert.equal(result.cash.received, 120);
    assert.equal(result.trend.length, 12);
    assert.equal(result.trend.at(-1)?.cash.received, 120);
    assert.equal(result.items.find((r) => r.id === b)?.status, 'FREE');
    assert.equal(result.items.find((r) => r.id === e)?.net, null);
    assert.equal(result.items.find((r) => r.id === n)?.status, 'NONE');
    const tpi = await svc.monthly(u, { month: '2026-10', site: 'TPI' });
    assert.equal(tpi.summary.enrolled, 4);
    assert.equal(tpi.items.find((r) => r.id === e)?.billCount, 0); // history site vs bill snapshot
    const trinity = await svc.monthly(u, { month: '2026-10', site: 'TRINITY' });
    assert.equal(trinity.summary.enrolled, 1);
    assert.equal(trinity.summary.drafts, 1);
    assert.equal(trinity.summary.rate, null);
    assert.equal(
      (await svc.monthly(u, { month: '2026-10', scope: 'REVIEW' })).total,
      2,
    );
    assert.equal(
      (await svc.monthly(u, { month: '2026-10', status: 'DRAFT' })).total,
      2,
    );
    assert.equal(
      (await svc.monthly(u, { month: '2026-10', status: 'FINALIZED' })).total,
      2,
    );
    assert.equal((await svc.monthly(u, { month: '2026-10', q: 'A' })).total, 1);
    assert.equal(
      (
        await svc.monthly(
          { ...u, entId: randomUUID() },
          { month: '2026-10', scope: 'ALL' },
        )
      ).total,
      0,
    );
    const batch = {
      requestId: randomUUID(),
      month: '2026-10',
      title: 'Monthly',
      roster: 'MONTH',
      site: 'TPI',
    };
    const preview = (await svc.activeDrafts(u, batch, false)) as {
      eligible: number;
    };
    assert.equal(preview.eligible, 1); // only N
    const registered = (await svc.activeDrafts(u, batch, true)) as {
      created: number;
    };
    assert.equal(registered.created, 1);
    assert.deepEqual(await svc.activeDrafts(u, batch, true), registered);
    assert.equal(
      (await svc.monthly(u, { month: '2026-10' })).summary.missing,
      0,
    );
    const before = (
      await ds.query(
        'SELECT count(*)::int n FROM amb_acm_pay_bill WHERE ent_id=$1',
        [ent],
      )
    )[0].n;
    await svc.monthly(u, { month: '2026-10' }, true);
    assert.equal(
      (
        await ds.query(
          'SELECT count(*)::int n FROM amb_acm_pay_bill WHERE ent_id=$1',
          [ent],
        )
      )[0].n,
      before,
    );
    await ds.query(
      "INSERT INTO amb_acm_std_student(std_id,ent_id,std_name,std_site,std_status,std_admission_date,std_start_date) SELECT gen_random_uuid(),$1,'Page '||n,'TPI','ACTIVE','2026-10-01','2026-10-01' FROM generate_series(1,101)n",
      [ent],
    );
    const pageOne = await svc.monthly(u, { month: '2026-10' });
    const pageTwo = await svc.monthly(u, { month: '2026-10', page: 2 });
    const exported = await svc.monthly(u, { month: '2026-10' }, true);
    assert.equal(pageOne.items.length, 50);
    assert.equal(pageTwo.items.length, 50);
    assert.equal(pageOne.total, 105);
    assert.equal(exported.items.length, 105);
    assert.equal(pageOne.summary.net, pageTwo.summary.net);
    assert.equal(pageOne.summary.enrolled, 105);
    const previewLarge = (await svc.activeDrafts(
      u,
      { ...batch, requestId: randomUUID() },
      false,
    )) as { eligible: number };
    assert.equal(previewLarge.eligible, 101);
    const unassigned = await add('Unassigned', '2026-10-01', '2026-10-01');
    await ds.query(
      "INSERT INTO amb_acm_dsh_operating_period(ent_id,kind,subject_id,site,start_date,source_key) VALUES($1,'STUDENT',$2,NULL,'2026-10-01',$3)",
      [ent, unassigned, randomUUID()],
    );
    const unassignedBatch = {
      ...batch,
      requestId: randomUUID(),
      site: 'UNASSIGNED',
      studentId: unassigned,
    };
    assert.equal(
      (
        (await svc.activeDrafts(u, unassignedBatch, true)) as {
          created: number;
        }
      ).created,
      1,
    );
    const unassignedBills = await svc.list(u, {
      from: '2026-10',
      to: '2026-10',
      site: 'UNASSIGNED',
    });
    assert.equal(unassignedBills.summary.count, 1);
    assert.equal(unassignedBills.items[0].site, null);
    const historic = await add(
      'Historic',
      '2026-10-01',
      '2026-10-01',
      '2026-11-01',
      'WITHDRAWN',
    );
    assert.equal(
      (
        (await svc.activeDrafts(
          u,
          { ...batch, studentId: historic, requestId: randomUUID() },
          true,
        )) as { created: number }
      ).created,
      1,
    );
    await assert.rejects(() =>
      svc.activeDrafts(
        u,
        { ...batch, requestId: randomUUID(), month: '1900-01' },
        false,
      ),
    );
    console.log(
      'PASS: monthly admission boundaries, end-exclusive withdrawal, returning gap, site transfer/dedupe, unknown dates, no-bill/DRAFT/zero distinction, multiple bills, cash vs billing month/refund, snapshot sites, search/status/export scope, tenant isolation, monthly draft/idempotency, read-only query',
    );
  } finally {
    for (const table of [
      'amb_acm_pay_bill_audit',
      'amb_acm_pay_bill_adjustment',
      'amb_acm_pay_collection',
      'amb_acm_pay_request',
      'amb_acm_pay_bill',
      'amb_acm_dsh_operating_period',
      'amb_acm_std_student',
    ])
      await ds.query(`DELETE FROM ${table} WHERE ent_id=$1`, [ent]);
    await ds.destroy();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
