import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { InquiryService } from '../../../src/modules/acm-csl/application/inquiry.service';
import { MapApplyService } from '../../../src/modules/acm-csl/application/map-apply.service';
import { MapApplyNotifierService } from '../../../src/modules/acm-csl/application/map-apply-notifier.service';
import { StdInheritanceService } from '../../../src/modules/acm-csl/application/std-inheritance.service';
import { CslEnrollmentRegistrationService } from '../../../src/modules/acm-csl/application/csl-enrollment-registration.service';
import { TenantSettingsService } from '../../../src/modules/acm-system/application/tenant-settings.service';
import { AesGcmService } from '../../../src/modules/acm-common/crypto/aes-gcm.service';
import { ACM_DS } from '../../../src/modules/acm-common/datasource';
import { InquiryTypeormEntity as Inquiry } from '../../../src/modules/acm-csl/infrastructure/typeorm/inquiry.typeorm-entity';
import { MapApplyTypeormEntity as Apply } from '../../../src/modules/acm-csl/infrastructure/typeorm/map-apply.typeorm-entity';
import { MapTestTypeormEntity } from '../../../src/modules/acm-csl/infrastructure/typeorm/map-test.typeorm-entity';
import { TrialClassTypeormEntity } from '../../../src/modules/acm-csl/infrastructure/typeorm/trial-class.typeorm-entity';
import { EnrollmentTypeormEntity } from '../../../src/modules/acm-csl/infrastructure/typeorm/enrollment.typeorm-entity';
import { CancellationTypeormEntity } from '../../../src/modules/acm-csl/infrastructure/typeorm/cancellation.typeorm-entity';
import { TransitionTypeormEntity } from '../../../src/modules/acm-csl/infrastructure/typeorm/transition.typeorm-entity';

describe('consultation profile editing (PostgreSQL)', () => {
  let pg: StartedPostgreSqlContainer,
    ds: DataSource,
    service: InquiryService,
    maps: MapApplyService;
  const ent = randomUUID();
  const create = (
    kind: 'MAP_TEST' | 'TUTORING' = 'MAP_TEST',
    english = 'Ji-hu Kim',
  ) =>
    service.create(ent, {
      studentName: 'Synthetic QA',
      studentNameEn: english,
      phoneStatus: 'UNKNOWN',
      kind,
      inflowType: 'PHONE',
      applyType: 'EXAM_ONLY',
      grade: 'G5',
      birthdate: '2015-01-01',
    });
  beforeAll(async () => {
    pg = await new PostgreSqlContainer(
      process.env.ACM_TEST_PG_IMAGE ?? 'postgres:16-alpine',
    ).start();
    ds = await new DataSource({
      type: 'postgres',
      url: pg.getConnectionUri(),
      entities: [Inquiry, Apply],
      synchronize: true,
    }).initialize();
    await ds.query(
      `CREATE SEQUENCE test_seq; CREATE FUNCTION acm_csl_next_seq_no(uuid) RETURNS bigint LANGUAGE sql AS 'SELECT nextval(''test_seq'')'; CREATE UNIQUE INDEX test_apply_inq ON amb_acm_csl_map_apply(ent_id, inq_id); CREATE TABLE amb_acm_sch_school(sch_id uuid, ent_id uuid, deleted_at timestamptz)`,
    );
    const module = await Test.createTestingModule({
      providers: [
        InquiryService,
        MapApplyService,
        { provide: getDataSourceToken(ACM_DS), useValue: ds },
        ...[Inquiry, Apply].map((entity) => ({
          provide: getRepositoryToken(entity, ACM_DS),
          useValue: ds.getRepository(entity),
        })),
        ...[
          MapTestTypeormEntity,
          TrialClassTypeormEntity,
          EnrollmentTypeormEntity,
          CancellationTypeormEntity,
          TransitionTypeormEntity,
        ].map((entity) => ({
          provide: getRepositoryToken(entity, ACM_DS),
          useValue: {},
        })),
        {
          provide: AesGcmService,
          useValue: new AesGcmService(
            new ConfigService({ ACM_PII_KEY: 'ab'.repeat(32) }),
          ),
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: StdInheritanceService, useValue: {} },
        { provide: CslEnrollmentRegistrationService, useValue: {} },
        {
          provide: TenantSettingsService,
          useValue: { getTimezone: async () => 'Asia/Seoul' },
        },
        {
          provide: MapApplyNotifierService,
          useValue: { notifyNewApplication: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(InquiryService);
    maps = module.get(MapApplyService);
  });
  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (pg) await pg.stop();
  });
  beforeEach(async () => {
    await ds.query(
      'TRUNCATE amb_acm_csl_inquiry, amb_acm_csl_map_apply, amb_acm_sch_school',
    );
  });
  it('creates encrypted English name and exactly one MAP row; tutoring has no MAP row', async () => {
    const a = await create();
    const row = await ds.getRepository(Inquiry).findOneByOrFail({ id: a.id });
    expect(a.studentNameEn).toBe('Ji-hu Kim');
    expect(row.englishNameEncrypted?.toString()).not.toBe(a.studentNameEn);
    expect(await ds.getRepository(Apply).count()).toBe(1);
    await create('TUTORING', '');
    expect(await ds.getRepository(Apply).count()).toBe(1);
  });
  it('updates only supplied fields, encrypts contacts and clears phone coherently', async () => {
    const a = await create();
    const b = await service.update(ent, a.id, {
      parentName: 'Guardian',
      parentEmail: 'qa@example.test',
      parentPhone: '01012345678',
    });
    expect(b).toMatchObject({
      grade: 'G5',
      studentNameEn: 'Ji-hu Kim',
      phoneStatus: 'PROVIDED',
      parentName: 'Guardian',
    });
    const row = await ds.getRepository(Inquiry).findOneByOrFail({ id: a.id });
    expect(row.parentEmailEncrypted?.toString()).not.toBe('qa@example.test');
    const c = await service.update(ent, a.id, {
      parentPhone: '',
      phoneStatus: 'UNKNOWN',
    });
    expect(c.parentPhone).toBeNull();
    expect(c.phoneStatus).toBe('UNKNOWN');
    expect(c.parentEmail).toBe('qa@example.test');
  });
  it('syncs MAP edit in both directions and preserves metadata', async () => {
    const a = await create();
    const row = await ds.getRepository(Apply).findOneByOrFail({ inqId: a.id });
    await maps.update(ent, row.id, {
      studentNameEn: 'New Name',
      birthdate: '2014-02-03',
      examLocation: 'Seoul',
    });
    expect(
      service.toView(
        await ds.getRepository(Inquiry).findOneByOrFail({ id: a.id }),
      ),
    ).toMatchObject({ studentNameEn: 'New Name', birthdate: '2014-02-03' });
    await service.update(ent, a.id, { studentNameEn: '', birthdate: null });
    expect(
      await ds.getRepository(Apply).findOneByOrFail({ id: row.id }),
    ).toMatchObject({
      studentNameEn: null,
      birthdate: null,
      examLocation: 'Seoul',
    });
  });
  it('rejects stale updates and tenant mismatch', async () => {
    const a = await create();
    await service.update(ent, a.id, { grade: 'G6' });
    await expect(
      service.update(ent, a.id, {
        grade: 'G7',
        expectedUpdatedAt: a.updatedAt.toISOString(),
      }),
    ).rejects.toThrow('INQUIRY_CHANGED');
    await expect(
      service.update(randomUUID(), a.id, { grade: 'G7' }),
    ).rejects.toThrow('INQUIRY_NOT_FOUND');
    const row = await ds.getRepository(Apply).findOneByOrFail({ inqId: a.id });
    await maps.update(ent, row.id, { studentNameEn: 'Changed' });
    await expect(
      maps.update(ent, row.id, {
        studentNameEn: 'Stale',
        expectedUpdatedAt: row.updatedAt.toISOString(),
      }),
    ).rejects.toThrow('MAP_APPLY_CHANGED');
  });
  it('rolls back inquiry when MAP write fails', async () => {
    const a = await create();
    await ds.query(
      "ALTER TABLE amb_acm_csl_map_apply ADD CONSTRAINT test_reject_name CHECK (mpa_student_name_en <> 'Reject')",
    );
    try {
      await expect(
        service.update(ent, a.id, { studentNameEn: 'Reject', grade: 'G9' }),
      ).rejects.toThrow();
    } finally {
      await ds.query(
        'ALTER TABLE amb_acm_csl_map_apply DROP CONSTRAINT test_reject_name',
      );
    }
    expect(
      service.toView(
        await ds.getRepository(Inquiry).findOneByOrFail({ id: a.id }),
      ),
    ).toMatchObject({ studentNameEn: 'Ji-hu Kim', grade: 'G5' });
  });
  it('adopts a legacy English name, and explicit deletion does not resurrect it', async () => {
    const a = await create();
    await ds
      .getRepository(Inquiry)
      .update(a.id, {
        englishNameEncrypted: null,
        englishNameIv: null,
        englishNameAuthTag: null,
      });
    expect(
      (await service.update(ent, a.id, { grade: 'G6' })).studentNameEn,
    ).toBe('Ji-hu Kim');
    await service.update(ent, a.id, { studentNameEn: '' });
    expect(
      (await service.update(ent, a.id, { grade: 'G7' })).studentNameEn,
    ).toBeNull();
  });
  it('validates school tenancy and clears FK for free text', async () => {
    const a = await create();
    const sch = randomUUID();
    await ds.query('INSERT INTO amb_acm_sch_school VALUES($1,$2,NULL)', [
      sch,
      ent,
    ]);
    await service.update(ent, a.id, {
      schoolId: sch,
      schoolFreetext: 'School',
    });
    await expect(
      service.update(ent, a.id, { schoolId: randomUUID() }),
    ).rejects.toThrow('SCHOOL_NOT_FOUND');
    expect(
      (await service.update(ent, a.id, { schoolFreetext: 'Other' })).schoolId,
    ).toBeNull();
  });
  it('imports English name without a duplicate MAP row, and reimport is idempotent', async () => {
    const dto = {
      site: 'TPI' as const,
      rows: [
        {
          submittedAt: '2026-09-01T01:00:00Z',
          studentName: 'QA Import',
          studentNameEn: 'QA English',
        },
      ],
    };
    expect(await maps.importRows(ent, dto)).toMatchObject({
      inserted: 1,
      failed: 0,
    });
    expect(await ds.getRepository(Apply).count()).toBe(1);
    expect(
      service.toView(
        await ds.getRepository(Inquiry).findOneByOrFail({ entId: ent }),
      ).studentNameEn,
    ).toBe('QA English');
    expect(await maps.importRows(ent, dto)).toMatchObject({
      inserted: 0,
      skipped: 1,
    });
  });
  it('accepts external MAP intake with one synchronized application', async () => {
    const result = await maps.createFromIntake(ent, 'TPI', {studentName:'External QA',studentNameEn:'English QA',parentPhone:'01012345678',birthdate:'20150101',grade:'G5',examLocation:'Seoul',consent:true});
    expect(await ds.getRepository(Apply).count()).toBe(1);
    expect(await maps.detail(ent,result.mpaId)).toMatchObject({studentNameEn:'English QA',origin:'WEB',birthdate:'2015-01-01'});
    expect(service.toView(await ds.getRepository(Inquiry).findOneByOrFail({id:result.inqId})).studentNameEn).toBe('English QA');
  });

});
