import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { SourceCurrentService } from '../../../src/modules/acm-dsh/application/source-current.service';

describe('Current source counts (PostgreSQL)', () => {
  let pg: StartedPostgreSqlContainer;
  let ds: DataSource;
  let service: SourceCurrentService;
  const a = '00000000-0000-0000-0000-000000000001';
  const b = '00000000-0000-0000-0000-000000000002';
  beforeAll(async () => {
    pg = await new PostgreSqlContainer(
      process.env.ACM_TEST_PG_IMAGE ?? 'tac-postgres-acm:pg16-bigm',
    )
      .withPullPolicy({ shouldPull: () => false })
      .start();
    ds = await new DataSource({
      type: 'postgres',
      url: pg.getConnectionUri(),
    }).initialize();
    await ds.query(`CREATE TABLE amb_acm_std_student(std_id int,ent_id uuid,std_status text,std_admission_date date,std_withdrawn_date date,deleted_at timestamptz);
      CREATE TABLE amb_acm_tch_teacher(tch_id int,ent_id uuid,tch_status text,tch_hired_at date,tch_is_instructor boolean,deleted_at timestamptz);
      CREATE TABLE amb_acm_std_student_teacher(ent_id uuid,std_id int,tch_id int);`);
    service = new SourceCurrentService(ds);
  });
  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (pg) await pg.stop();
  });
  beforeEach(async () => {
    await ds.query(
      'TRUNCATE amb_acm_std_student,amb_acm_tch_teacher,amb_acm_std_student_teacher',
    );
    await ds.query(
      `INSERT INTO amb_acm_std_student VALUES (1,$1,'ACTIVE',NULL,NULL,NULL),(2,$1,'ACTIVE','2026-09-01',NULL,NULL),(3,$1,'INACTIVE',NULL,NULL,NULL),(4,$1,'WITHDRAWN',NULL,NULL,NULL),(5,$1,'ACTIVE',NULL,NULL,NOW()),(6,$2,'ACTIVE',NULL,NULL,NULL)`,
      [a, b],
    );
    await ds.query(
      `INSERT INTO amb_acm_tch_teacher VALUES (1,$1,'ACTIVE',NULL,true,NULL),(2,$1,'ACTIVE','2026-01-01',true,NULL),(3,$1,'LEAVE',NULL,true,NULL),(4,$1,'RESIGNED',NULL,true,NULL),(5,$1,'ACTIVE',NULL,false,NULL),(6,$1,'ACTIVE',NULL,true,NOW()),(7,$2,'ACTIVE',NULL,true,NULL)`,
      [a, b],
    );
  });
  it('counts masters without accounts and reports missing dates', async () => {
    expect(await service.getCurrent(a)).toMatchObject({
      activeStudents: 2,
      inactiveStudents: 1,
      withdrawnStudents: 1,
      activeTeachers: 2,
      missingAdmissionDates: 1,
      missingWithdrawalDates: 1,
      missingHireDates: 1,
      assignedStudents: 0,
      assignedTeachers: 0,
    });
  });
  it('deduplicates both ends of many-to-many assignments', async () => {
    await ds.query(
      'INSERT INTO amb_acm_std_student_teacher VALUES ($1,1,1),($1,1,2),($1,2,1),($1,1,1)',
      [a],
    );
    expect(await service.getCurrent(a)).toMatchObject({
      assignedStudents: 2,
      assignedTeachers: 2,
    });
  });
  it('excludes deleted, inactive, non-instructor, orphan and cross-tenant links', async () => {
    await ds.query(
      'INSERT INTO amb_acm_std_student_teacher VALUES ($1,1,1),($1,3,2),($1,4,2),($1,5,2),($1,2,3),($1,2,4),($1,2,5),($1,2,6),($1,2,7),($1,6,2),($1,9,2),($2,2,2)',
      [a, b],
    );
    expect(await service.getCurrent(a)).toMatchObject({
      assignedStudents: 1,
      assignedTeachers: 1,
    });
    expect(await service.getCurrent(b)).toMatchObject({
      activeStudents: 1,
      activeTeachers: 1,
      assignedStudents: 0,
      assignedTeachers: 0,
    });
  });
  it('reflects direct import deletion and restoration without recomputation', async () => {
    await ds.query(
      'UPDATE amb_acm_std_student SET deleted_at=NOW() WHERE ent_id=$1 AND std_id=1',
      [a],
    );
    expect((await service.getCurrent(a)).activeStudents).toBe(1);
    await ds.query(
      'UPDATE amb_acm_std_student SET deleted_at=NULL WHERE ent_id=$1 AND std_id=1',
      [a],
    );
    expect((await service.getCurrent(a)).activeStudents).toBe(2);
  });
  it('returns observed zeros for an empty tenant', async () => {
    expect(
      await service.getCurrent('00000000-0000-0000-0000-000000000003'),
    ).toMatchObject({
      activeStudents: 0,
      activeTeachers: 0,
      assignedStudents: 0,
      assignedTeachers: 0,
    });
  });
});
