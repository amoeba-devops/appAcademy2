import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { StudentDeletionService } from '../src/modules/acm-std/application/student-deletion.service';
async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 5434,
    username: 'acm',
    password: 'acm',
    database: 'acm_lifecycle_test_notifications_261013',
  });
  await ds.initialize();
  await ds.query(
    readFileSync('../sql/acm/1029-std-status-history.sql', 'utf8'),
  );
  await ds.query(readFileSync('../sql/acm/1031-student-deletion.sql', 'utf8'));
  const ent = randomUUID(),
    user = randomUUID(),
    student = randomUUID(),
    other = randomUUID(),
    inq = randomUUID(),
    evt = randomUUID(),
    bill = randomUUID();
  const svc = new StudentDeletionService(ds),
    u = { id: user, entId: ent };
  try {
    await ds.query(
      "INSERT INTO amb_acm_user(usr_id,ent_id,usr_email,usr_name,usr_status,auth_source,ama_user_id,ama_role) VALUES($1,$2,$3,'Delete Tester','ACTIVE','ama',$1,'MASTER')",
      [user, ent, user + '@example.invalid'],
    );
    await ds.query(
      "INSERT INTO amb_acm_std_student(std_id,ent_id,std_name) VALUES($1,$2,'Synthetic test student'),($3,$2,'Unrelated student')",
      [student, ent, other],
    );
    for (const role of ['MEMBER', 'UNKNOWN']) {
      await ds.query('UPDATE amb_acm_user SET ama_role=$2 WHERE usr_id=$1', [
        user,
        role,
      ]);
      assert.equal((await svc.access(u)).canDelete, false);
      await assert.rejects(() => svc.archive(u, student));
    }
    for (const role of ['MASTER', 'OWNER', 'MANAGER']) {
      await ds.query('UPDATE amb_acm_user SET ama_role=$2 WHERE usr_id=$1', [
        user,
        role,
      ]);
      assert.equal((await svc.access(u)).canDelete, true);
    }
    await assert.rejects(() =>
      svc.archive({ ...u, entId: randomUUID() }, student),
    );
    await ds.query(
      "INSERT INTO amb_acm_csl_inquiry(inq_id,ent_id,inq_std_id,inq_is_anonymous,inq_seq_no,inq_name_encrypted,inq_name_iv,inq_name_auth_tag,inq_inflow_type,inq_apply_type,school_freetext) VALUES($1,$2,$3,true,1,$4,$4,$4,'PHONE','BOTH','Synthetic school')",
      [inq, ent, student, Buffer.from('synthetic')],
    );
    await ds.query(
      "INSERT INTO amb_acm_cal_event(evt_id,ent_id,evt_owner_user_id,evt_category,evt_title,evt_start_at,evt_end_at) VALUES($1,$2,$3,'CLASS','Deletion test',now(),now()+interval '1 hour')",
      [evt, ent, user],
    );
    await ds.query(
      "INSERT INTO amb_acm_cal_invitee(ent_id,evt_id,inv_kind,inv_ref_id) VALUES($1,$2,'STUDENT',$3)",
      [ent, evt, student],
    );
    await ds.query(
      "INSERT INTO amb_acm_pay_bill(pbl_id,ent_id,std_id,pbl_month,pbl_due,pbl_kind,pbl_title,pbl_amount,pbl_source_key,created_by) VALUES($1,$2,$3,'2026-10','2026-10-20','CLASS','Test bill',100,'test',$4)",
      [bill, ent, student, user],
    );
    await ds.query(
      "INSERT INTO amb_acm_pay_collection(ent_id,pbl_id,pcl_type,pcl_amount,pcl_date,pcl_method,pcl_reason,created_by) VALUES($1,$2,'PAYMENT',100,'2026-10-13','OTHER','test data',$3)",
      [ent, bill, user],
    );
    const cls = randomUUID(),
      session = randomUUID();
    await ds.query(
      "INSERT INTO amb_acm_cls_classes(cls_id,ent_id,cls_code,cls_inq_id,cls_subject_type,cls_started_at) VALUES($1,$2,'DEL-TEST',$3,'OTHER','2026-10-13')",
      [cls, ent, inq],
    );
    await ds.query(
      'INSERT INTO amb_acm_cls_sessions(ses_id,ent_id,cls_id,ses_seq_no,ses_scheduled_at,ses_duration_min) VALUES($1,$2,$3,1,now(),60)',
      [session, ent, cls],
    );
    await ds.query(
      'UPDATE amb_acm_cal_event SET evt_cls_id=$2 WHERE evt_id=$1',
      [evt, cls],
    );
    await ds.query(
      "INSERT INTO amb_acm_cal_event_attachment(ent_id,evt_id,cea_s3_key,cea_filename,cea_mime,cea_size_bytes) VALUES($1,$2,$3,'test.txt','text/plain',1)",
      [ent, evt, `cal-events/${ent}/${evt}/synthetic-test.txt`],
    );
    for (const change of [
      "auth_source='local'",
      "usr_status='INACTIVE'",
      'usr_locked_at=now()',
    ]) {
      await ds.query(`UPDATE amb_acm_user SET ${change} WHERE usr_id=$1`, [
        user,
      ]);
      assert.equal((await svc.access(u)).canDelete, false);
      await assert.rejects(() => svc.archive(u, student));
      await ds.query(
        "UPDATE amb_acm_user SET auth_source='ama',usr_status='ACTIVE',usr_locked_at=NULL WHERE usr_id=$1",
        [user],
      );
    }
    await svc.archive(u, student);
    await svc.archive(u, student);
    assert.equal((await svc.list(u, 1)).total, 1);
    assert.equal((await svc.list(u, 1, true)).total, 1);
    assert.equal(
      (
        await ds.query(
          'SELECT count(*)::int AS n FROM amb_acm_csl_inquiry WHERE inq_id=$1',
          [inq],
        )
      )[0].n,
      1,
    );
    let p = await svc.preview(u, student);
    assert.equal(p.counts.consultations, 1);
    assert.equal(p.counts.events, 1);
    assert.equal(p.counts.classes, 1);
    assert.equal(p.counts.collections, 1);
    assert.deepEqual(p.blocked, []);
    await assert.rejects(() =>
      svc.purge(u, student, {
        name: p.student.name,
        testConfirmed: false,
        version: p.version,
      }),
    );
    await assert.rejects(() =>
      svc.purge(u, student, {
        name: 'wrong',
        testConfirmed: true,
        version: p.version,
      }),
    );
    await ds.query(
      "UPDATE amb_acm_pay_bill SET pbl_memo='changed' WHERE pbl_id=$1",
      [bill],
    );
    await assert.rejects(() =>
      svc.purge(u, student, {
        name: p.student.name,
        testConfirmed: true,
        version: p.version,
      }),
    );
    await ds.query(
      "INSERT INTO amb_acm_cal_invitee(ent_id,evt_id,inv_kind,inv_ref_id) VALUES($1,$2,'STUDENT',$3)",
      [ent, evt, other],
    );
    p = await svc.preview(u, student);
    assert(p.blocked.includes('SHARED_RECORDS'));
    await assert.rejects(() =>
      svc.purge(u, student, {
        name: p.student.name,
        testConfirmed: true,
        version: p.version,
      }),
    );
    await ds.query(
      'DELETE FROM amb_acm_cal_invitee WHERE evt_id=$1 AND inv_ref_id=$2',
      [evt, other],
    );
    p = await svc.preview(u, student);
    // Unknown FK at the final student deletion must roll back all already-deleted children and history.
    const blocker = 'test_delete_block_' + student.replace(/-/g, '');
    await ds.query(
      `CREATE TABLE ${blocker}(std_id uuid REFERENCES amb_acm_std_student(std_id))`,
    );
    try {
      await ds.query(`INSERT INTO ${blocker} VALUES($1)`, [student]);
      await assert.rejects(() =>
        svc.purge(u, student, {
          name: p.student.name,
          testConfirmed: true,
          version: p.version,
        }),
      );
      assert.equal(
        (
          await ds.query(
            'SELECT count(*)::int AS n FROM amb_acm_pay_bill WHERE pbl_id=$1',
            [bill],
          )
        )[0].n,
        1,
      );
      assert.equal((await svc.list(u, 1, true)).total, 1);
    } finally {
      await ds.query(`DROP TABLE ${blocker}`);
    }
    await svc.purge(u, student, {
      name: p.student.name,
      testConfirmed: true,
      version: p.version,
    });
    for (const [table, key, value] of [
      ['amb_acm_std_student', 'std_id', student],
      ['amb_acm_csl_inquiry', 'inq_id', inq],
      ['amb_acm_cal_event', 'evt_id', evt],
      ['amb_acm_pay_bill', 'pbl_id', bill],
    ])
      assert.equal(
        (
          await ds.query(
            `SELECT count(*)::int AS n FROM ${table} WHERE ${key}=$1`,
            [value],
          )
        )[0].n,
        0,
      );
    assert.equal(
      (
        await ds.query(
          'SELECT count(*)::int AS n FROM amb_acm_std_student WHERE std_id=$1',
          [other],
        )
      )[0].n,
      1,
    );
    assert.equal(
      (
        await ds.query(
          'SELECT count(*)::int AS n FROM amb_acm_std_deleted_file WHERE ent_id=$1 AND sdf_done_at IS NULL',
          [ent],
        )
      )[0].n,
      1,
    );
    const history = await svc.list(u, 1, true);
    assert.equal(history.total, 2);
    assert.equal(history.items[0].actorName, 'Delete Tester');
    console.log(
      'PASS: AMA roles, tenant isolation, archive preservation, preview changes, confirmations, shared records, purge, history',
    );
  } finally {
    for (const table of [
      'amb_acm_pay_bill_adjustment',
      'amb_acm_pay_bill_audit',
      'amb_acm_pay_collection',
      'amb_acm_pay_bill',
      'amb_acm_cal_event_attachment',
      'amb_acm_cal_invitee',
      'amb_acm_cal_event',
      'amb_acm_cls_sessions',
      'amb_acm_cls_classes',
      'amb_acm_csl_inquiry',
      'amb_acm_std_status_history',
      'amb_acm_std_student',
      'amb_acm_std_deleted_file',
      'amb_acm_std_deletion_history',
      'amb_acm_user',
    ])
      await ds.query(`DELETE FROM ${table} WHERE ent_id=$1`, [ent]);
    await ds.destroy();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
