import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('optional inquiry school migration', () => {
  let pg: StartedPostgreSqlContainer, ds: DataSource;
  const sqlRoot = resolve(__dirname, '../../../../sql/acm');
  const migration = readFileSync(resolve(sqlRoot,'1017-csl-inquiry-school-optional.sql'),'utf8');
  const initial = readFileSync(resolve(sqlRoot,'100-acm-v1.0a-init.sql'),'utf8');
  const start = initial.indexOf('CREATE TABLE IF NOT EXISTS amb_acm_csl_inquiry (');
  const ddl = initial.slice(start, initial.indexOf('CREATE INDEX',start));
  const schoolId = '00000000-0000-0000-0000-000000000011';
  let seq = 0;
  beforeAll(async()=>{
    pg=await new PostgreSqlContainer('postgres:16-alpine').withPullPolicy({shouldPull:()=>false}).start();
    ds=await new DataSource({type:'postgres',url:pg.getConnectionUri()}).initialize();
    await ds.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE TABLE amb_acm_sch_school(sch_id uuid PRIMARY KEY);');
    await ds.query(ddl);
    await ds.query('INSERT INTO amb_acm_sch_school VALUES($1)',[schoolId]);
  });
  afterAll(async()=>{if(ds?.isInitialized)await ds.destroy();if(pg)await pg.stop();});
  async function insert(school: string|null, text: string|null) {
    return ds.query(`INSERT INTO amb_acm_csl_inquiry(ent_id,inq_seq_no,inq_name_encrypted,inq_name_iv,inq_name_auth_tag,inq_inflow_type,inq_apply_type,school_id,school_freetext)
      VALUES('00000000-0000-0000-0000-000000000001',$1,$2,$3,$4,'PHONE','COUNSELING_ONLY',$5,$6)
      RETURNING school_id,school_freetext`,[++seq,Buffer.from('test'),Buffer.alloc(12),Buffer.alloc(16),school,text]);
  }
  it('reproduces the exact 23514 constraint error before migration',async()=>{
    await expect(insert(null,null)).rejects.toMatchObject({driverError:{code:'23514',constraint:'chk_acm_csl_inq_school'}});
  });
  it('allows school-less intake after the migration and leaves existing records intact',async()=>{
    await insert(null,'Existing school');
    const before=await ds.query('SELECT * FROM amb_acm_csl_inquiry');
    await ds.query(migration);
    expect(await ds.query('SELECT * FROM amb_acm_csl_inquiry')).toEqual(before);
    expect(await insert(null,null)).toEqual([{school_id:null,school_freetext:null}]);
  });
  it('is idempotent and still accepts linked or free-text school',async()=>{
    await ds.query(migration);
    expect(await insert(schoolId,null)).toEqual([{school_id:schoolId,school_freetext:null}]);
    expect(await insert(null,'학교')).toEqual([{school_id:null,school_freetext:'학교'}]);
  });
  it('keeps school foreign key integrity',async()=>{
    await expect(insert('00000000-0000-0000-0000-000000000099',null)).rejects.toMatchObject({driverError:{code:'23503'}});
  });
});
