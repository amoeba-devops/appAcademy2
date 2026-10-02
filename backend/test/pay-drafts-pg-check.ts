import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
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
  const ent = randomUUID();
  const u = { entId: ent, id: randomUUID(), role: 'ADMIN' as const };
  const svc = new CollectionsService(ds, {
    getTimezone: async () => 'Asia/Seoul',
  } as unknown as TenantSettingsService);
  try {
    for (const file of ['1026-pay-collections.sql', '1027-pay-bill-drafts.sql'])
      await ds.query(readFileSync('../sql/acm/' + file, 'utf8'));
    await ds.query(
      "INSERT INTO amb_acm_std_student(std_id,ent_id,std_name,std_status) SELECT gen_random_uuid(),$1,'Draft student '||n,'ACTIVE' FROM generate_series(1,105) n",
      [ent],
    );
    await ds.query(
      "INSERT INTO amb_acm_std_student(std_id,ent_id,std_name,std_status) VALUES(gen_random_uuid(),$1,'Inactive','INACTIVE')",
      [ent],
    );
    const options = await svc.options(u, {});
    assert.equal(options.students.length, 100);
    assert.equal(options.hasMore, true);
    const student = options.students[0].id;
    await svc.create(u, {
      requestId: randomUUID(),
      items: [
        {
          studentId: student,
          month: '2026-10',
          title: 'Existing',
          amount: 100,
          discount: 0,
          due: '2026-10-20',
          kind: 'CLASS',
        },
      ],
    });
    const batch = {
      requestId: randomUUID(),
      month: '2026-10',
      title: 'Monthly tuition',
    };
    const preview = (await svc.activeDrafts(u, batch, false)) as {
      total: number;
      eligible: number;
    };
    assert.equal(preview.total, 105);
    assert.equal(preview.eligible, 104);
    const [first, second] = (await Promise.all([
      svc.activeDrafts(u, batch, true),
      svc.activeDrafts(u, { ...batch, requestId: randomUUID() }, true),
    ])) as { created: number }[];
    assert.equal(first.created + second.created, 104);
    assert.deepEqual(await svc.activeDrafts(u, batch, true), first);
    assert.equal((await svc.list(u, {})).summary.drafts, 104);
    assert.equal((await svc.list(u, {})).summary.net, 100);
    const d = (await svc.list(u, { status: 'DRAFT' })).items[0];
    assert.equal(d.amount, null);
    assert.equal(d.due, null);
    assert.equal(d.unpaid, null);
    assert.equal(d.net, null);
    await assert.rejects(
      () =>
        svc.collect(u, d.id, {
          requestId: randomUUID(),
          version: d.version,
          amount: 1,
          date: '2026-10-02',
          method: 'CASH',
          reason: 'reject draft',
        }),
      /PAY_DRAFT_NOT_READY/,
    );
    await svc.state(
      u,
      d.id,
      { requestId: randomUUID(), version: 1, reason: 'Cancel draft' },
      false,
    );
    await svc.state(
      u,
      d.id,
      { requestId: randomUUID(), version: 2, reason: 'Restore draft' },
      true,
    );
    assert.equal((await svc.detail(u, d.id)).bill.state, 'DRAFT');
    await svc.edit(u, {
      requestId: randomUUID(),
      reason: 'Finalize zero fee',
      items: [
        {
          id: d.id,
          version: 3,
          amount: 0,
          discount: 0,
          due: '2026-10-20',
          title: d.title,
          memo: '',
        },
      ],
    });
    assert.equal((await svc.detail(u, d.id)).bill.state, 'ACTIVE');
    assert.equal((await svc.list(u, { status: 'FREE' })).summary.count, 1);
    assert.equal(
      (await svc.list({ ...u, entId: randomUUID() }, {})).summary.count,
      0,
    );
    assert.equal(
      (
        (await svc.activeDrafts(
          u,
          { ...batch, requestId: randomUUID() },
          false,
        )) as { eligible: number }
      ).eligible,
      0,
    );
    console.log(
      'PASS: 105 active students, 100-result search limit bypass, inactive exclusion, existing exclusion, concurrent/retry dedupe, NULL vs zero, summary exclusion, draft collection block, cancel/restore/finalize, tenant isolation',
    );
  } finally {
    for (const table of [
      'amb_acm_pay_bill_audit',
      'amb_acm_pay_bill_adjustment',
      'amb_acm_pay_collection',
      'amb_acm_pay_request',
      'amb_acm_pay_bill',
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
