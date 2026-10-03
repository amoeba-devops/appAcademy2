// Local PostgreSQL only; isolated schema and rollback, never application rows.
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createRequire}=require('node:module');const {execFileSync}=require('node:child_process');
const {readFileSync}=require('node:fs');const {Client}=createRequire(process.cwd()+'/package.json')('pg');
test('status migration captures all SQL writes, explicit dates, tenant isolation, rollback and baseline idempotence',async()=>{
 const info=JSON.parse(execFileSync('docker',['inspect','acm-postgres'],{encoding:'utf8'}))[0];
 const env=Object.fromEntries(info.Config.Env.map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]}));
 const c=new Client({host:'127.0.0.1',port:5434,user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,database:env.POSTGRES_DB||env.POSTGRES_USER});
 await c.connect();try{
 await c.query('BEGIN');await c.query('CREATE SCHEMA test_pay_status_261003');await c.query('SET LOCAL search_path TO test_pay_status_261003,public');
 await c.query(`CREATE TABLE amb_acm_std_student(std_id uuid PRIMARY KEY,ent_id uuid,std_status text,std_admission_date date,std_withdrawn_date date,std_site text)`);
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 await c.query(`INSERT INTO amb_acm_std_student VALUES($1,$1,'ACTIVE','2026-09-01',NULL,'TPI')`,[a]);
 const sql=readFileSync('../sql/acm/1029-std-status-history.sql','utf8').replace(/^BEGIN;/,'').replace(/COMMIT;\s*$/,'');
 await c.query(sql);await c.query(sql);
 assert.equal((await c.query('SELECT * FROM amb_acm_std_status_history')).rowCount,1);
 await c.query(`UPDATE amb_acm_std_student SET std_status='INACTIVE' WHERE std_id=$1`,[a]);
 let h=(await c.query(`SELECT * FROM amb_acm_std_status_history WHERE ssh_status='INACTIVE'`)).rows[0];assert.equal(h.ssh_date,null);assert.equal(h.ssh_previous,'ACTIVE');
 await c.query(`SELECT set_config('acm.status_date','2026-10-02',true),set_config('acm.status_actor',$1,true)`,[b]);
 await c.query(`UPDATE amb_acm_std_student SET std_status='ACTIVE' WHERE std_id=$1`,[a]);
 h=(await c.query(`SELECT ssh_date::text date,ssh_actor FROM amb_acm_std_status_history WHERE ssh_previous='INACTIVE'`)).rows[0];assert.equal(h.date,'2026-10-02');assert.equal(h.ssh_actor,b);
 await c.query(`SELECT set_config('acm.status_date','',true),set_config('acm.status_actor','',true)`);
 await c.query(`INSERT INTO amb_acm_std_student VALUES($1,$1,'WITHDRAWN','2026-08-01','2026-09-02','TRINITY')`,[b]);
 assert.equal((await c.query('SELECT * FROM amb_acm_std_status_history WHERE ent_id=$1',[a])).rowCount,3);
 assert.equal((await c.query('SELECT * FROM amb_acm_std_status_history WHERE ent_id=$1',[b])).rowCount,1);
 await c.query('SAVEPOINT mutation');await c.query(`UPDATE amb_acm_std_student SET std_status='WITHDRAWN' WHERE std_id=$1`,[a]);await c.query('ROLLBACK TO mutation');
 assert.equal((await c.query('SELECT * FROM amb_acm_std_status_history WHERE ent_id=$1',[a])).rowCount,3);
 await c.query(`UPDATE amb_acm_std_student SET std_status='ACTIVE' WHERE std_id=$1`,[b]);
 await c.query(`UPDATE amb_acm_std_student SET std_status='WITHDRAWN' WHERE std_id=$1`,[b]);
 assert.equal((await c.query(`SELECT ssh_date FROM amb_acm_std_status_history WHERE ent_id=$1 AND ssh_previous='ACTIVE'`,[b])).rows[0].ssh_date,null);
 }finally{await c.query('ROLLBACK');await c.end()}
});
