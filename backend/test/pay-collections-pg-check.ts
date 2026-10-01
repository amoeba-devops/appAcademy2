import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { CollectionsService } from '../src/modules/acm-pay/application/collections.service';
import { TenantSettingsService } from '../src/modules/acm-system/application/tenant-settings.service';
import { BillInput } from '../src/modules/acm-pay/application/dto/collections.dto';
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
    other = randomUUID(),
    student = randomUUID(),
    inactive = randomUUID();
  const u = { entId: ent, id: randomUUID(), role: 'ADMIN' as const };
  const svc = new CollectionsService(ds, {
    getTimezone: async () => 'Asia/Seoul',
  } as unknown as TenantSettingsService);
  try {
    await ds.query(readFileSync('../sql/acm/1026-pay-collections.sql', 'utf8'));
    await ds.query(
      "INSERT INTO amb_acm_std_student(std_id,ent_id,std_name,std_site,std_status) VALUES($1,$2,'Synthetic student','TPI','ACTIVE'),($3,$2,'Inactive','TPI','WITHDRAWN')",
      [student, ent, inactive],
    );
    const item: BillInput = {
      studentId: student,
      month: '2026-10',
      due: '2026-10-05',
      kind: 'CLASS',
      title: 'Synthetic tuition',
      amount: 300000,
      discount: 20000,
    };
    const create = { requestId: randomUUID(), items: [item] };
    assert.equal((await svc.preview(u, create)).eligible, 1);
    const [a, b] = (await Promise.all([
      svc.create(u, create),
      svc.create(u, create),
    ])) as { ids: string[] }[];
    assert.deepEqual(a, b);
    const id = a.ids[0];
    assert.equal((await svc.list(u, {})).summary.count, 1);
    await assert.rejects(
      () => svc.create(u, { ...create, items: [{ ...item, amount: 99 }] }),
      /PAY_REQUEST_MISMATCH/,
    );
    assert.equal(
      (
        await svc.preview(u, {
          requestId: randomUUID(),
          items: [item, { ...item, studentId: inactive }],
        })
      ).eligible,
      0,
    );
    assert.equal((await svc.list({ ...u, entId: other }, {})).summary.count, 0);
    await assert.rejects(
      () => svc.detail({ ...u, entId: other }, id),
      /PAY_BILL_NOT_FOUND/,
    );
    const pay = {
      requestId: randomUUID(),
      version: 1,
      amount: 100000,
      date: '2026-10-01',
      method: 'TRANSFER',
      reason: 'First payment',
    };
    const receipt = (await svc.collect(u, id, pay)) as { id: string };
    assert.deepEqual(await svc.collect(u, id, pay), receipt);
    let detail = await svc.detail(u, id);
    assert.equal(detail.bill.unpaid, 180000);
    const q = await svc.list(u, {
      basis: 'PAYMENT',
      from: '2026-10-01',
      to: '2026-10-01',
    });
    assert.equal(q.summary.unpaid, 180000);
    assert.equal(q.summary.periodReceived, 100000);
    const concurrency = await Promise.allSettled(
      [1, 2].map(() =>
        svc.collect(u, id, {
          ...pay,
          requestId: randomUUID(),
          version: 2,
          amount: 180000,
          date: '2026-10-02',
        }),
      ),
    );
    assert.equal(concurrency.filter((x) => x.status === 'fulfilled').length, 1);
    detail = await svc.detail(u, id);
    assert.equal(detail.bill.unpaid, 0);
    await assert.rejects(
      () =>
        svc.collect(u, id, {
          ...pay,
          requestId: randomUUID(),
          version: 3,
          amount: 1,
        }),
      /PAY_OVERPAYMENT/,
    );
    await svc.refund(u, id, {
      requestId: randomUUID(),
      version: 3,
      amount: 50000,
      date: '2026-10-03',
      method: 'TRANSFER',
      reason: 'Cancel part of class',
      originalId: receipt.id,
      type: 'REFUND',
      reduceBill: true,
    });
    detail = await svc.detail(u, id);
    assert.equal(detail.bill.net, 230000);
    assert.equal(detail.bill.received, 230000);
    assert.equal(detail.bill.unpaid, 0);
    await assert.rejects(
      () =>
        svc.refund(u, id, {
          requestId: randomUUID(),
          version: 4,
          amount: 50001,
          date: '2026-10-03',
          method: 'TRANSFER',
          reason: 'Too much',
          originalId: receipt.id,
          type: 'REFUND',
          reduceBill: false,
        }),
      /PAY_REFUND_EXCEEDS_PAYMENT/,
    );
    await svc.refund(u, id, {
      requestId: randomUUID(),
      version: 4,
      amount: 50000,
      date: '2026-10-03',
      method: 'TRANSFER',
      reason: 'Wrong payment',
      originalId: receipt.id,
      type: 'REVERSAL',
      reduceBill: false,
    });
    detail = await svc.detail(u, id);
    assert.equal(detail.bill.unpaid, 50000);
    await svc.adjust(u, id, {
      requestId: randomUUID(),
      version: 5,
      amount: 50000,
      reason: 'Fee waived',
    });
    assert.equal((await svc.detail(u, id)).bill.unpaid, 0);
    await svc.adjust(u, id, {
      requestId: randomUUID(),
      version: 6,
      amount: -50000,
      reason: 'Restore fee',
    });
    assert.equal((await svc.detail(u, id)).bill.unpaid, 50000);
    await assert.rejects(
      () =>
        svc.state(
          u,
          id,
          { requestId: randomUUID(), version: 7, reason: 'Cannot delete' },
          false,
        ),
      /PAY_HAS_COLLECTIONS/,
    );
    const r = (await svc.create(u, {
      requestId: randomUUID(),
      items: [
        {
          ...item,
          title: 'Other fee',
          kind: 'OTHER',
          amount: 5000,
          discount: 0,
        },
      ],
    })) as { ids: string[] };
    const second = r.ids[0];
    const before = (await svc.detail(u, second)).bill;
    await assert.rejects(() =>
      svc.edit(u, {
        requestId: randomUUID(),
        reason: 'Atomic failure',
        items: [
          {
            id: second,
            version: 1,
            amount: 6000,
            discount: 0,
            due: item.due,
            title: 'Other fee',
            memo: '',
          },
          {
            id,
            version: 999,
            amount: 300000,
            discount: 20000,
            due: item.due,
            title: item.title,
            memo: '',
          },
        ],
      }),
    );
    assert.equal((await svc.detail(u, second)).bill.amount, before.amount);
    await svc.state(
      u,
      second,
      { requestId: randomUUID(), version: 1, reason: 'Cancel unpaid' },
      false,
    );
    assert.equal((await svc.list(u, { canceled: 'true' })).summary.count, 1);
    await svc.state(
      u,
      second,
      { requestId: randomUUID(), version: 2, reason: 'Restore' },
      true,
    );
    await assert.rejects(() =>
      svc.stateBatch(u, {
        requestId: randomUUID(),
        reason: 'Atomic cancel failure',
        restore: false,
        items: [
          { id: second, version: 3 },
          { id, version: 999 },
        ],
      }),
    );
    assert.equal((await svc.detail(u, second)).bill.state, 'ACTIVE');
    await svc.stateBatch(u, {
      requestId: randomUUID(),
      reason: 'Batch cancel',
      restore: false,
      items: [{ id: second, version: 3 }],
    });
    assert.equal((await svc.detail(u, second)).bill.state, 'CANCELED');
    await svc.stateBatch(u, {
      requestId: randomUUID(),
      reason: 'Batch restore',
      restore: true,
      items: [{ id: second, version: 4 }],
    });
    assert.equal((await svc.detail(u, second)).bill.state, 'ACTIVE');
    await assert.rejects(() =>
      svc.list(u, { basis: 'PAYMENT', from: '2026-02-30', to: '2026-03-01' }),
    );
    const options = await svc.options(u, {});
    assert.equal(options.students.length, 2);
    const exported = await svc.list(
      u,
      { basis: 'PAYMENT', from: '2026-10-01', to: '2026-10-01' },
      true,
    );
    assert.equal(exported.summary.periodReceived, 100000);
    assert.equal(exported.summary.unpaid, 50000);
    assert.equal(
      (
        await svc.list(u, {
          method: 'TRANSFER',
          site: 'TPI',
          q: 'Synthetic',
          status: 'PARTIAL',
        })
      ).summary.count,
      1,
    );
    console.log(
      'PASS: PG tenant isolation, duplicate generation, retry mismatch, installments, concurrent payments, refunds/reversals/adjustments, balance, atomic edit rollback, cancel/restore, payment-period totals and options',
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
