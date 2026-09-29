import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { kstDaysAgo } from '../src/modules/acm-dsh/business-date';
import { KPI_FIELDS } from '../src/modules/acm-dsh/application/kpi-aggregation';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { LifecycleService } from '../src/modules/acm-dsh/application/lifecycle.service';
import { TodayLiveService } from '../src/modules/acm-dsh/application/today-live.service';
import { SourceCurrentService } from '../src/modules/acm-dsh/application/source-current.service';
import { DailyKpiService } from '../src/modules/acm-dsh/application/daily-kpi.service';
import { OperatingService } from '../src/modules/acm-dsh/application/operating.service';
import { MetricDefinitionService } from '../src/modules/acm-dsh/application/metric-definition.service';
import { AesGcmService } from '../src/modules/acm-common/crypto/aes-gcm.service';
import { DailyKpiTypeormEntity } from '../src/modules/acm-dsh/infrastructure/typeorm/daily-kpi.typeorm-entity';
import { MetricDefinitionTypeormEntity } from '../src/modules/acm-dsh/infrastructure/typeorm/metric-definition.typeorm-entity';
config({ path: process.env.ACM_TEST_ENV_FILE ?? '.env', quiet: true });
async function main() {
  const database =
    process.env.ACM_LIFECYCLE_TEST_DB ?? 'acm_lifecycle_test_260929';
  if (!database.startsWith('acm_lifecycle_test_'))
    throw new Error('A dedicated lifecycle test database is required');
  const ds = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 5434,
    username: process.env.ACM_PG_USER || 'acm',
    password: process.env.ACM_PG_PASSWORD || 'acm',
    database,
    entities: [DailyKpiTypeormEntity, MetricDefinitionTypeormEntity],
    synchronize: false,
  });
  await ds.initialize();
  const ent = randomUUID(),
    other = randomUUID(),
    student = randomUUID(),
    referrer = randomUUID(),
    inquiry = randomUUID(),
    actor = randomUUID();
  const today = kstDaysAgo(0),
    yesterday = kstDaysAgo(1);
  try {
    const crypto = new AesGcmService(
      new ConfigService({ ACM_PII_KEY: 'ab'.repeat(32) }),
    );
    const lifecycle = new LifecycleService(ds, crypto);
    const live = new TodayLiveService(
      ds,
      new SourceCurrentService(ds),
      new DailyKpiService(ds),
      new OperatingService(ds),
      lifecycle,
      new MetricDefinitionService(
        ds.getRepository(MetricDefinitionTypeormEntity),
      ),
    );
    await ds.query(
      "INSERT INTO amb_acm_std_student(std_id,ent_id,std_name,std_site,std_start_date,std_admission_date,std_withdrawn_date) VALUES($1,$2,'Test Student','TPI',$3,$3,$4),($5,$2,'Test Referrer','TPI',NULL,NULL,NULL)",
      [student, ent, today, yesterday, referrer],
    );
    const enc = crypto.encrypt('Test Student');
    await ds.query(
      "INSERT INTO amb_acm_csl_inquiry(inq_id,ent_id,inq_seq_no,inq_name_encrypted,inq_name_iv,inq_name_auth_tag,inq_inflow_type,inq_apply_type,inq_std_id,inq_source_site,school_freetext) VALUES($1,$2,1,$3,$4,$5,'PHONE','BOTH',$6,'TPI','Test School')",
      [inquiry, ent, enc.ciphertext, enc.iv, enc.authTag, student],
    );
    await ds.query(
      'INSERT INTO amb_acm_csl_enrollment(ent_id,inq_id,enr_tuition_paid,enr_payment_date,enr_payment_amount) VALUES($1,$2,true,$3,10000)',
      [ent, inquiry, yesterday],
    );
    for (const [i, code] of Object.keys(KPI_FIELDS).entries())
      await ds.query(
        `INSERT INTO amb_acm_dsh_metric_definitions(ent_id,met_code,met_category,met_label_kr,met_label_en,met_aggregation_type,met_data_source,met_display_order_in_category) VALUES($1,$2,$3,$2,$2,'VOLUME_COUNT','MANUAL',$4)`,
        [
          ent,
          code,
          code.startsWith('mkt')
            ? 'MARKETING'
            : code.startsWith('cs')
              ? 'CS'
              : code.startsWith('ops')
                ? 'OPERATING'
                : 'CLASS',
          i,
        ],
      );
    const base = {
      subjectKind: 'STUDENT' as const,
      subjectId: student,
      site: 'TPI',
      effectiveDate: today,
    };
    await lifecycle.record(ent, actor, {
      ...base,
      kind: 'SCHEDULE',
      status: 'SCHEDULING',
    });
    await lifecycle.record(ent, actor, {
      ...base,
      kind: 'SCHEDULE',
      status: 'SCHEDULING',
    });
    assert.equal(
      (await lifecycle.list(ent, 'STUDENT', student)).length,
      1,
      'retry is idempotent',
    );
    await lifecycle.record(ent, actor, {
      ...base,
      kind: 'FIRST_PAYMENT',
      effectiveDate: yesterday,
      verified: true,
    });
    await lifecycle.record(ent, actor, {
      ...base,
      kind: 'REFERRAL',
      relatedKind: 'STUDENT',
      relatedId: referrer,
      verified: true,
    });
    await lifecycle.record(ent, actor, {
      ...base,
      kind: 'RETURN',
      relatedKind: 'STUDENT',
      relatedId: student,
      stoppedDate: yesterday,
      verified: true,
    });
    const result = await live.get(ent);
    assert.equal(result.metrics.length, Object.keys(KPI_FIELDS).length + 5);
    for (const m of result.metrics)
      assert.ok(m.code in result.values, 'every registry metric present');
    assert.equal(result.values.cs_new_class.calculated, 1);
    assert.equal(result.values.cs_scheduling.calculated, 1);
    assert.equal(result.values.ops_new_st.calculated, 1);
    assert.equal(result.values.ops_returning_st.calculated, 1);
    assert.equal(result.values.ops_referral_st.calculated, 1);
    assert.equal(
      (await lifecycle.details(ent, today, 'cs_new_class'))[0].name,
      'Test Student',
    );
    assert.equal(
      (await lifecycle.range(other, today, today)).summary.cs_new_class
        .calculated,
      0,
    );
    await assert.rejects(
      lifecycle.record(other, actor, {
        ...base,
        kind: 'SCHEDULE',
        status: 'SCHEDULING',
      }),
    );
    await lifecycle.record(ent, actor, {
      ...base,
      kind: 'FIRST_CLASS',
      verified: true,
    });
    assert.equal(
      (await lifecycle.range(ent, today, today)).summary.ops_new_st.calculated,
      0,
    );
    assert.equal(
      (await lifecycle.range(ent, yesterday, yesterday)).summary.ops_new_st
        .calculated,
      1,
    );
    const records = (await lifecycle.list(ent, 'STUDENT', student)) as Array<{
      id: string;
      kind: string;
    }>;
    const referral = records.find((r) => r.kind === 'REFERRAL')!;
    await lifecycle.cancel(ent, referral.id, actor, 'ADMIN');
    assert.equal(
      (await lifecycle.range(ent, today, today)).summary.ops_referral_st
        .calculated,
      0,
    );
    await ds.query(
      'UPDATE amb_acm_std_student SET std_start_date=$3 WHERE ent_id=$1 AND std_id=$2',
      [ent, student, yesterday],
    );
    assert.equal(
      (await lifecycle.range(ent, today, today)).summary.cs_new_class
        .calculated,
      0,
    );
    assert.equal(
      (await lifecycle.range(ent, yesterday, yesterday)).summary.cs_new_class
        .calculated,
      1,
    );
    console.log(
      'PostgreSQL integration passed: all metrics, New Class date correction, verified payment, first class, return, referral, cancellation, idempotency, details and tenant isolation.',
    );
  } finally {
    for (const table of [
      'amb_acm_dsh_lifecycle_event',
      'amb_acm_dsh_metric_definitions',
      'amb_acm_csl_enrollment',
      'amb_acm_csl_inquiry',
      'amb_acm_std_student',
    ])
      await ds.query(`DELETE FROM ${table} WHERE ent_id=$1`, [ent]);
    await ds.destroy();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
