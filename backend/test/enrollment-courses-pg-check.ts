import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { InquiryService } from '../src/modules/acm-csl/application/inquiry.service';
import { InquiryTypeormEntity } from '../src/modules/acm-csl/infrastructure/typeorm/inquiry.typeorm-entity';
import { EnrollmentTypeormEntity } from '../src/modules/acm-csl/infrastructure/typeorm/enrollment.typeorm-entity';
config({ path: process.env.ACM_TEST_ENV_FILE ?? '.env', quiet: true });
async function main() {
  const database =
    process.env.ACM_LIFECYCLE_TEST_DB ?? 'acm_lifecycle_test_260929';
  if (!database.startsWith('acm_lifecycle_test_'))
    throw new Error('Dedicated test DB required');
  const ds = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 5434,
    username: process.env.ACM_PG_USER || 'acm',
    password: process.env.ACM_PG_PASSWORD || 'acm',
    database,
    entities: [InquiryTypeormEntity, EnrollmentTypeormEntity],
    synchronize: false,
  });
  await ds.initialize();
  const ent = randomUUID(),
    other = randomUUID(),
    inq = randomUUID(),
    a = randomUUID(),
    b = randomUUID(),
    c = randomUUID();
  const service = Object.create(InquiryService.prototype) as InquiryService;
  Object.assign(service, {
    ds,
    inq: ds.getRepository(InquiryTypeormEntity),
    enrollments: ds.getRepository(EnrollmentTypeormEntity),
  });
  try {
    await ds.query(
      `INSERT INTO amb_acm_csl_inquiry(inq_id,ent_id,inq_seq_no,inq_name_encrypted,inq_name_iv,inq_name_auth_tag,inq_inflow_type,inq_apply_type,school_freetext) VALUES($1,$2,1,$3,$3,$3,'PHONE','BOTH','Test School')`,
      [inq, ent, Buffer.from('test')],
    );
    await ds.query(
      `INSERT INTO amb_acm_csl_course(crs_id,ent_id,crs_code,crs_name) VALUES($1,$2,'A','Course A'),($3,$2,'B','Course B'),($4,$5,'C','Other tenant')`,
      [a, ent, b, c, other],
    );
    await service.upsertEnrollment(ent, inq, {
      courseIds: [a, b],
      tuitionAmount: 1500000,
      applied: true,
      sessionCount: 12,
      endDate: '2030-12-31',
    });
    let result = await service.getEnrollment(ent, inq);
    assert.deepEqual(new Set(result!.courseIds), new Set([a, b]));
    assert.equal(Number(result!.tuitionAmount), 1500000);
    await service.upsertEnrollment(ent, inq, {
      courseIds: [a],
      tuitionAmount: 0,
    });
    result = await service.getEnrollment(ent, inq);
    assert.deepEqual(result!.courseIds, [a]);
    assert.equal(result!.applied, true);
    assert.equal(result!.sessionCount, 12);
    assert.equal(result!.endDate, '2030-12-31');
    assert.equal(Number(result!.tuitionAmount), 0);
    await assert.rejects(
      service.upsertEnrollment(ent, inq, { courseIds: [c], tuitionAmount: 99 }),
    );
    assert.equal(
      Number((await service.getEnrollment(ent, inq))!.tuitionAmount),
      0,
      'failed update rolls back amount',
    );
    await ds.query(
      'UPDATE amb_acm_csl_course SET crs_is_active=false WHERE crs_id=$1',
      [a],
    );
    await service.upsertEnrollment(ent, inq, { courseIds: [a, b] });
    await service.upsertEnrollment(ent, inq, { courseIds: [] });
    assert.deepEqual((await service.getEnrollment(ent, inq))!.courseIds, []);
    await assert.rejects(
      service.upsertEnrollment(ent, inq, { courseIds: [a] }),
    );
    await assert.rejects(
      service.upsertEnrollment(ent, inq, { courseIds: [b, b] }),
    );
    await service.upsertEnrollment(ent, inq, { courseId: b });
    assert.deepEqual((await service.getEnrollment(ent, inq))!.courseIds, [b]);
    await service.upsertEnrollment(ent, inq, { counselMemo: 'Unrelated edit' });
    assert.deepEqual((await service.getEnrollment(ent, inq))!.courseIds, [b]);
    await assert.rejects(
      service.upsertEnrollment(other, inq, { courseIds: [] }),
    );
    // Simulate an old single-course row, then rerun the additive migration twice.
    await ds.query(
      'DELETE FROM amb_acm_csl_enrollment_course WHERE ent_id=$1',
      [ent],
    );
    const migration = readFileSync(
      '../sql/acm/1022-csl-enrollment-courses.sql',
      'utf8',
    );
    await ds.query(migration);
    await ds.query(migration);
    assert.deepEqual((await service.getEnrollment(ent, inq))!.courseIds, [b]);
    await service.upsertEnrollment(ent, inq, { startDate: '2031-01-01' });
    assert.equal(
      (await service.getEnrollment(ent, inq))!.endDate,
      '2030-12-31',
    );
    await assert.rejects(
      service.upsertEnrollment(ent, inq, { endDate: '2030-01-01' }),
    );
    console.log(
      'PostgreSQL passed: multiple courses, deselection, empty/omitted arrays, inactive retention, tenant isolation, transaction rollback, zero tuition, legacy compatibility, idempotent backfill and removed-field preservation.',
    );
  } finally {
    for (const table of [
      'amb_acm_csl_enrollment_course',
      'amb_acm_csl_enrollment',
      'amb_acm_csl_inquiry',
      'amb_acm_csl_course',
    ])
      await ds.query(`DELETE FROM ${table} WHERE ent_id=ANY($1::uuid[])`, [
        [ent, other],
      ]);
    await ds.destroy();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
