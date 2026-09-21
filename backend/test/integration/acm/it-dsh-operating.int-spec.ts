import { TeacherTypeormEntity } from '../../../src/modules/acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { TeacherService } from '../../../src/modules/acm-tch/application/teacher.service';
import { AcmUserTypeormEntity } from '../../../src/modules/acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { AcmAuthService } from '../../../src/modules/acm-auth/application/acm-auth.service';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { OperatingService } from '../../../src/modules/acm-dsh/application/operating.service';
describe('operating periods PostgreSQL', () => {
  let pg: StartedPostgreSqlContainer, ds: DataSource, service: OperatingService;
  const a = '00000000-0000-0000-0000-000000000001',
    b = '00000000-0000-0000-0000-000000000002';
  const id = '10000000-0000-0000-0000-000000000001';
  beforeAll(async () => {
    pg = await new PostgreSqlContainer(
      process.env.ACM_TEST_PG_IMAGE ?? 'tac-postgres-acm:pg16-bigm',
    )
      .withPullPolicy({ shouldPull: () => false })
      .start();
    ds = await new DataSource({
      type: 'postgres',
      url: pg.getConnectionUri(),
      entities: [TeacherTypeormEntity],
      synchronize: true,
    }).initialize();
    await ds.query(
      `CREATE TABLE amb_acm_dsh_daily_kpi(ent_id uuid,dkp_date date,dkp_manually_overridden boolean); CREATE TABLE amb_acm_std_student(std_id uuid PRIMARY KEY,ent_id uuid,std_site text,std_start_date date,std_end_date date,deleted_at timestamptz);`,
    );
    await ds.query(
      readFileSync(
        resolve(
          __dirname,
          '../../../../sql/acm/999v-acm-dsh-operating-period.sql',
        ),
        'utf8',
      ),
    );
    await ds.query(
      readFileSync(
        resolve(
          __dirname,
          '../../../../sql/acm/999w-acm-tch-employment-dates.sql',
        ),
        'utf8',
      ),
    );
    service = new OperatingService(ds);
  });
  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (pg) await pg.stop();
  });
  beforeEach(async () => {
    await ds.query(
      'TRUNCATE amb_acm_std_student,amb_acm_tch_teacher,amb_acm_dsh_operating_period,amb_acm_dsh_operating_manual,amb_acm_dsh_operating_audit',
    );
    await ds.query(
      `INSERT INTO amb_acm_std_student VALUES($1,$2,'TPI','2024-12-02',NULL,NULL)`,
      [id, a],
    );
  });
  it('reads master dates live and keeps ALL equal to sites', async () => {
    expect(
      (await service.range(a, '2026-09-01', '2026-09-01')).summary.ops_count_st
        ?.calculated,
    ).toBe(1);
    expect(
      (await service.range(b, '2026-09-01', '2026-09-01')).summary.ops_count_st
        ?.calculated,
    ).toBe(0);
    await ds.query(
      'UPDATE amb_acm_std_student SET std_end_date=$1 WHERE std_id=$2',
      ['2026-09-01', id],
    );
    expect(
      (await service.range(a, '2026-09-01', '2026-09-01')).summary.ops_count_st
        ?.calculated,
    ).toBe(0);
  });
  it('saves corrections with optimistic concurrency and preserves other tenant', async () => {
    await service.savePeriod(a, a, 'STUDENT', id, {
      start: '2024-12-02',
      end: '2026-01-01',
      site: 'TPI',
      replaceMaster: true,
    });
    const [p] = await service.list(a, 'STUDENT', id);
    await expect(
      service.savePeriod(b, b, 'STUDENT', id, { start: '2024-12-02' }),
    ).rejects.toThrow();
    await service.savePeriod(a, a, 'STUDENT', id, {
      id: p.id!,
      revision: 1,
      start: '2024-12-02',
      end: '2026-01-02',
      site: 'TPI',
    });
    await expect(
      service.savePeriod(a, a, 'STUDENT', id, {
        id: p.id!,
        revision: 1,
        start: '2024-12-02',
        site: 'TPI',
      }),
    ).rejects.toThrow();
    expect(
      (
        await ds.query(
          'SELECT count(*)::int n FROM amb_acm_dsh_operating_audit',
        )
      )[0].n,
    ).toBe(2);
  });
  it('preserves first period when adding re-entry and updates one matching master period', async () => {
    await ds.query(
      'UPDATE amb_acm_std_student SET std_end_date=$1 WHERE std_id=$2',
      ['2026-01-01', id],
    );
    await service.savePeriod(a, a, 'STUDENT', id, {
      start: '2026-02-01',
      site: 'TRINITY',
    });
    expect(await service.list(a, 'STUDENT', id)).toHaveLength(2);
    await ds.query(
      'UPDATE amb_acm_std_student SET std_end_date=$1 WHERE std_id=$2',
      ['2026-01-02', id],
    );
    const r = await service.range(a, '2024-12-02', '2026-02-01');
    expect(r.summary.ops_new_st?.calculated).toBe(2);
    expect(r.summary.ops_count_st?.calculated).toBe(1);
  });
  it('manual zero, clear and scope are independent of computed data', async () => {
    await service.saveManual(a, a, '2026-09-01', 'TPI', { ops_new_st: 0 });
    expect(
      (await service.range(a, '2026-09-01', '2026-09-01', 'TPI')).summary
        .ops_new_st,
    ).toMatchObject({ manual: 0, manualPresent: true });
    expect(
      (await service.range(a, '2026-09-01', '2026-09-01')).summary.ops_new_st
        ?.manualPresent,
    ).toBe(false);
    await service.saveManual(a, a, '2026-09-01', 'TPI', { ops_new_st: null });
    expect(
      (await service.range(a, '2026-09-01', '2026-09-01', 'TPI')).summary
        .ops_new_st?.manualPresent,
    ).toBe(false);
  });
  const tid = '20000000-0000-0000-0000-000000000001';
  async function teacherFixture() {
    await ds
      .getRepository(TeacherTypeormEntity)
      .save({
        id: tid,
        entId: a,
        name: 'Test teacher',
        email: null,
        status: 'ACTIVE',
        isInstructor: true,
        hiredAt: '2025-01-01',
        endedAt: '2025-06-01',
      });
    return new TeacherService(
      ds.getRepository(TeacherTypeormEntity),
      ds.getRepository(AcmUserTypeormEntity),
      {} as AcmAuthService,
    );
  }
  it('persists teacher end date, clears null and rejects stale or cross-tenant edits', async () => {
    const teachers = await teacherFixture();
    let teacher = await teachers.update(a, tid, { tchEndedAt: '2025-07-01' });
    expect(teacher.endedAt).toBe('2025-07-01');
    expect(teacher.status).toBe('ACTIVE');
    const stale = teacher.updatedAt.toISOString();
    teacher = await teachers.update(a, tid, {
      tchEndedAt: null,
      expectedUpdatedAt: stale,
    });
    expect(teacher.endedAt).toBeNull();
    expect(
      (
        await ds
          .getRepository(TeacherTypeormEntity)
          .findOneByOrFail({ id: tid })
      ).endedAt,
    ).toBeNull();
    await expect(
      teachers.update(a, tid, {
        tchEndedAt: '2025-08-01',
        expectedUpdatedAt: stale,
      }),
    ).rejects.toThrow('TEACHER_DATES_CHANGED');
    await expect(
      teachers.update(b, tid, { tchEndedAt: '2025-08-01' }),
    ).rejects.toThrow('TEACHER_NOT_FOUND');
    await expect(
      teachers.update(a, tid, { tchEndedAt: '2024-12-01' }),
    ).rejects.toThrow('END_PRECEDES');
  });
  it('synchronizes teacher dates both ways, preserves re-entry and audits once per edit', async () => {
    const teachers = await teacherFixture();
    await service.savePeriod(a, a, 'TEACHER', tid, {
      start: '2025-08-01',
      end: '2025-10-01',
    });
    const before = await service.list(a, 'TEACHER', tid);
    expect(before).toHaveLength(2);
    const first = before[0];
    await teachers.update(a, tid, { tchEndedAt: '2025-06-02' });
    let periods = await service.list(a, 'TEACHER', tid);
    expect(periods[0]).toMatchObject({ end: '2025-06-02', revision: 2 });
    expect(periods[1]).toMatchObject({ start: '2025-08-01', revision: 1 });
    await service.savePeriod(a, a, 'TEACHER', tid, {
      id: first.id!,
      revision: 2,
      start: '2025-01-02',
      end: '2025-06-03',
    });
    const master = await ds
      .getRepository(TeacherTypeormEntity)
      .findOneByOrFail({ id: tid });
    expect(master).toMatchObject({
      hiredAt: '2025-01-02',
      endedAt: '2025-06-03',
    });
    periods = await service.list(a, 'TEACHER', tid);
    expect(periods[0].revision).toBe(3);
    expect(
      (
        await ds.query(
          'SELECT count(*)::int n FROM amb_acm_dsh_operating_audit',
        )
      )[0].n,
    ).toBe(4);
    await expect(teachers.update(a, tid, { tchEndedAt: null })).rejects.toThrow(
      'OVERLAPPING',
    );
    await expect(teachers.update(a, tid, { tchHiredAt: null })).rejects.toThrow(
      'EDIT_PERIOD',
    );
    expect(
      (
        await ds
          .getRepository(TeacherTypeormEntity)
          .findOneByOrFail({ id: tid })
      ).endedAt,
    ).toBe('2025-06-03');
    const day = await service.range(a, '2025-06-03', '2025-06-03');
    expect(day.summary.ops_out_tc?.calculated).toBe(1);
  });
  it('keeps fallback period edits and teacher master dates aligned', async () => {
    await teacherFixture();
    await service.savePeriod(a, a, 'TEACHER', tid, {
      start: '2025-02-01',
      end: null,
      replaceMaster: true,
    });
    expect(
      await ds.getRepository(TeacherTypeormEntity).findOneByOrFail({ id: tid }),
    ).toMatchObject({ hiredAt: '2025-02-01', endedAt: null });
    await expect(
      service.savePeriod(a, a, 'TEACHER', tid, {
        start: '2026-01-01',
        replaceMaster: true,
      }),
    ).rejects.toThrow();
  });
});
