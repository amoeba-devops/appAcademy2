import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource, Repository } from 'typeorm';
import { StdInheritanceService } from '../../../src/modules/acm-csl/application/std-inheritance.service';
import { StudentTypeormEntity } from '../../../src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity';
import { InquiryTypeormEntity } from '../../../src/modules/acm-csl/infrastructure/typeorm/inquiry.typeorm-entity';
import { MapTestTypeormEntity } from '../../../src/modules/acm-csl/infrastructure/typeorm/map-test.typeorm-entity';
import { AesGcmService } from '../../../src/modules/acm-common/crypto/aes-gcm.service';
describe('MAP inheritance atomic PostgreSQL update', () => {
  let pg: StartedPostgreSqlContainer,
    ds: DataSource,
    svc: StdInheritanceService;
  const inq = {
    id: 'inquiry',
    entId: 'tenant',
    stdId: 'student',
  } as InquiryTypeormEntity;
  const mt = {
    testType: 'MAP',
    inqId: 'inquiry',
    entId: 'tenant',
    scoreReading: 181,
    scoreMath: 216,
    scoreLanguage: null,
  } as MapTestTypeormEntity;
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
    await ds.query(
      `CREATE TABLE amb_acm_std_student(std_id text,ent_id text,std_map_reading int,std_map_math int,std_map_language int,deleted_at timestamptz,updated_at timestamptz)`,
    );
    // Deliberately stale read: a concurrent writer may fill scores after selection.
    svc = new StdInheritanceService(
      {
        findOne: async () => ({
          id: 'student',
          mapReading: null,
          mapMath: null,
          mapLanguage: null,
        }),
        query: ds.query.bind(ds),
      } as unknown as Repository<StudentTypeormEntity>,
      {} as AesGcmService,
    );
  });
  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (pg) await pg.stop();
  });
  beforeEach(async () => {
    await ds.query(
      `TRUNCATE amb_acm_std_student; INSERT INTO amb_acm_std_student VALUES('student','tenant',NULL,NULL,NULL,NULL,now())`,
    );
  });
  it('fills blanks and is idempotent even with stale reads', async () => {
    expect((await svc.inheritMapScoresOnClassStart(inq, mt)).applied).toBe(
      true,
    );
    expect((await svc.inheritMapScoresOnClassStart(inq, mt)).applied).toBe(
      false,
    );
    expect(
      (
        await ds.query(
          'SELECT std_map_reading,std_map_math,std_map_language FROM amb_acm_std_student',
        )
      )[0],
    ).toEqual({
      std_map_reading: 181,
      std_map_math: 216,
      std_map_language: null,
    });
  });
  it('preserves concurrent manual values including zero', async () => {
    await ds.query('UPDATE amb_acm_std_student SET std_map_reading=0');
    await Promise.all([
      svc.inheritMapScoresOnClassStart(inq, mt),
      svc.inheritMapScoresOnClassStart(inq, mt),
    ]);
    expect(
      (
        await ds.query(
          'SELECT std_map_reading,std_map_math FROM amb_acm_std_student',
        )
      )[0],
    ).toEqual({ std_map_reading: 0, std_map_math: 216 });
  });
  it('does not update deleted or other-tenant rows even with stale selection', async () => {
    await ds.query(
      "UPDATE amb_acm_std_student SET deleted_at=now(); INSERT INTO amb_acm_std_student VALUES('student','other',NULL,NULL,NULL,NULL,now())",
    );
    expect((await svc.inheritMapScoresOnClassStart(inq, mt)).applied).toBe(
      false,
    );
    expect(
      (
        await ds.query(
          'SELECT count(*)::int n FROM amb_acm_std_student WHERE std_map_reading IS NOT NULL',
        )
      )[0].n,
    ).toBe(0);
  });
});
