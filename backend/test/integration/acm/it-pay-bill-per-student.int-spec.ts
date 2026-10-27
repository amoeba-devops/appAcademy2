import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CollectionsService } from '../../../src/modules/acm-pay/application/collections.service';
import type { BillInput } from '../../../src/modules/acm-pay/application/dto/collections.dto';
import type { TenantSettingsService } from '../../../src/modules/acm-system/application/tenant-settings.service';
import type { AcmCurrentUser } from '../../../src/modules/acm-common/decorators/current-user.decorator';
import { applyAcmMigrations } from './setup';

// REQ-261027 — 학생별 청구 등록·엑셀 일괄등록.
const ENT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const user = { id: randomUUID(), entId: ENT } as AcmCurrentUser;
const bill = (
  studentId: string,
  extra: Partial<BillInput> = {},
): BillInput => ({
  studentId,
  month: '2026-11',
  due: '2026-11-10',
  kind: 'CLASS',
  title: '11월 수업료',
  amount: 450000,
  discount: 0,
  ...extra,
});

describe('pay bills — per-student registration (PostgreSQL)', () => {
  let pg: StartedPostgreSqlContainer;
  let db: DataSource;
  let svc: CollectionsService;
  let kim: string, lee: string, park: string, english: string, math: string;

  const student = async (name: string, site: string, status = 'ACTIVE') => {
    const [r]: { id: string }[] = await db.query(
      'INSERT INTO amb_acm_std_student(ent_id,std_name,std_site,std_status) VALUES($1,$2,$3,$4) RETURNING std_id AS id',
      [ENT, name, site, status],
    );
    return r.id;
  };
  const klass = async (code: string, label: string) => {
    const [r]: { id: string }[] = await db.query(
      "INSERT INTO amb_acm_cls_classes(ent_id,cls_code,cls_subject_type,cls_subject_label,cls_teacher_user_id,cls_started_at) VALUES($1,$2,'OTHER',$3,$4,'2026-09-01') RETURNING cls_id AS id",
      [ENT, code, label, randomUUID()],
    );
    return r.id;
  };
  const enrol = (cls: string, std: string) =>
    db.query(
      'INSERT INTO amb_acm_cls_class_students(ent_id,cls_id,cst_student_user_id,cst_hourly_rate) VALUES($1,$2,$3,10000)',
      [ENT, cls, std],
    );

  beforeAll(async () => {
    pg = await new PostgreSqlContainer(
      process.env.ACM_TEST_PG_IMAGE ?? 'tac-postgres-acm:pg16-bigm',
    )
      .withDatabase('pay_test')
      .withUsername('pay_test')
      .withPassword('pay_test')
      .withPullPolicy({ shouldPull: () => false })
      .start();
    db = await new DataSource({
      type: 'postgres',
      host: pg.getHost(),
      port: pg.getPort(),
      username: pg.getUsername(),
      password: pg.getPassword(),
      database: pg.getDatabase(),
      synchronize: false,
    }).initialize();
    await applyAcmMigrations(db);
    svc = new CollectionsService(db, {} as TenantSettingsService);
    kim = await student('김하늘', 'TPI');
    lee = await student('이준서', 'TPI');
    park = await student('박서윤', 'TRINITY', 'INACTIVE');
    english = await klass('EN-A', '중2 영어A');
    math = await klass('MA-B', '중2 수학B');
    await enrol(english, kim);
    await enrol(english, lee);
    await enrol(math, lee);
  }, 300_000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (pg) await pg.stop();
  });

  it('preview reports row problems as reasons instead of failing the batch', async () => {
    const r = await svc.preview(user, {
      requestId: randomUUID(),
      items: [
        bill(kim, { classId: english }),
        bill(kim, { classId: math, title: '수학' }),
        bill(lee, { discount: 500000 }),
        bill(randomUUID()),
      ],
    });
    expect(r.items.map((x) => x.reason)).toEqual([
      null,
      'NOT_ENROLLED',
      'INVALID_AMOUNT',
      'STUDENT_NOT_FOUND',
    ]);
    expect(r.items[1].studentName).toBe('김하늘');
    expect(r.eligible).toBe(1);
  });

  it('create still rejects a class the student is not enrolled in', async () => {
    await expect(
      svc.create(user, {
        requestId: randomUUID(),
        items: [bill(kim, { classId: math })],
      }),
    ).rejects.toThrow('PAY_STUDENT_NOT_ENROLLED');
  });

  it('options limits classes to the student when studentId is given', async () => {
    const all = await svc.options(user, {});
    expect(all.classes.map((c) => c.name).sort()).toEqual([
      '중2 수학B',
      '중2 영어A',
    ]);
    const forKim = await svc.options(user, { studentId: kim });
    expect(forKim.classes.map((c) => c.name)).toEqual(['중2 영어A']);
  });

  it('import data lists active students with their classes, filtered by site', async () => {
    const all = await svc.importData(user, {});
    expect(all.students.map((s) => s.name).sort()).toEqual([
      '김하늘',
      '이준서',
    ]);
    expect(
      all.students
        .find((s) => s.id === lee)
        ?.classes.map((c) => c.name)
        .sort(),
    ).toEqual(['중2 수학B', '중2 영어A']);
    expect(all.classes).toHaveLength(2);
    expect((await svc.importData(user, { site: 'TRINITY' })).students).toEqual(
      [],
    );
    expect(
      (await svc.importData({ ...user, entId: OTHER }, {})).students,
    ).toEqual([]);
    void park;
  });

  it('creates eligible rows once and reports re-uploads as duplicates', async () => {
    const items = [
      bill(kim, { classId: english }),
      bill(kim, { kind: 'BOOK', title: '11월 교재', amount: 35000 }),
      bill(lee, { classId: math, discount: 30000 }),
    ];
    const r = (await svc.create(user, { requestId: randomUUID(), items })) as {
      ids: string[];
    };
    expect(r.ids).toHaveLength(3);
    const again = await svc.preview(user, { requestId: randomUUID(), items });
    expect(again.items.map((x) => x.reason)).toEqual([
      'DUPLICATE',
      'DUPLICATE',
      'DUPLICATE',
    ]);
  });
});
