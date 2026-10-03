import { topStatistics } from './top-statistics';
import { monthlyPay, monthlyStudents, siteMatches } from './monthly-pay';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { createHash } from 'crypto';
import { ACM_DS } from '../../acm-common/datasource';
import { TenantSettingsService } from '../../acm-system/application/tenant-settings.service';
import {
  ActiveDraftBatchDto,
  MonthlyPayQuery,
  StateBatchDto,
  AdjustmentDto,
  BillActionDto,
  BillBatchDto,
  BillInput,
  BillQuery,
  CollectionDto,
  EditBatchDto,
  RefundDto,
} from './dto/collections.dto';
import type { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
export interface BillRow {
  id: string;
  studentId: string;
  studentName: string;
  grade: string | null;
  school: string | null;
  studentStatus: string;
  site: string | null;
  classId: string | null;
  className: string | null;
  teacherId: string | null;
  month: string;
  due: string | null;
  kind: string;
  title: string;
  amount: number | null;
  discount: number;
  adjustment: number;
  net: number | null;
  paid: number;
  refunded: number;
  received: number;
  unpaid: number | null;
  state: string;
  status: string;
  version: number;
  memo: string;
  methods: string[];
  paidDate: string | null;
  periodReceived: number;
}
const BILL_SELECT = `SELECT b.pbl_id AS id,b.std_id AS "studentId",s.std_name AS "studentName",s.std_grade AS grade,s.std_school AS school,
 s.std_status AS "studentStatus",b.pbl_site AS site,b.cls_id AS "classId",COALESCE(c.cls_subject_label,c.cls_code) AS "className",c.cls_teacher_tch_id AS "teacherId",
 b.pbl_month AS month,b.pbl_due::text AS due,b.pbl_kind AS kind,b.pbl_title AS title,b.pbl_amount::float8 AS amount,b.pbl_discount::float8 AS discount,
 COALESCE(a.adjustment,0)::float8 AS adjustment,(b.pbl_amount-b.pbl_discount-COALESCE(a.adjustment,0))::float8 AS net,
 COALESCE(p.paid,0)::float8 AS paid,COALESCE(p.refunded,0)::float8 AS refunded,COALESCE(p.received,0)::float8 AS received,
 CASE WHEN b.pbl_amount IS NULL THEN NULL ELSE GREATEST(b.pbl_amount-b.pbl_discount-COALESCE(a.adjustment,0)-COALESCE(p.received,0),0)::float8 END AS unpaid,
 b.pbl_status AS state,b.pbl_version AS version,b.pbl_memo AS memo,COALESCE(p.methods,ARRAY[]::text[]) AS methods,p.paid_date::text AS "paidDate"
 FROM amb_acm_pay_bill b JOIN amb_acm_std_student s ON s.std_id=b.std_id AND s.ent_id=b.ent_id
 LEFT JOIN amb_acm_cls_classes c ON c.cls_id=b.cls_id AND c.ent_id=b.ent_id
 LEFT JOIN LATERAL (SELECT sum(pba_amount) AS adjustment FROM amb_acm_pay_bill_adjustment WHERE ent_id=b.ent_id AND pbl_id=b.pbl_id) a ON true
 LEFT JOIN LATERAL (SELECT sum(CASE WHEN pcl_type='PAYMENT' THEN pcl_amount ELSE 0 END) AS paid,
 sum(CASE WHEN pcl_type<>'PAYMENT' THEN pcl_amount ELSE 0 END) AS refunded,
 sum(CASE WHEN pcl_type='PAYMENT' THEN pcl_amount ELSE -pcl_amount END) AS received,
 array_agg(DISTINCT pcl_method::text) FILTER(WHERE pcl_type='PAYMENT') AS methods,max(pcl_date) FILTER(WHERE pcl_type='PAYMENT') AS paid_date
 FROM amb_acm_pay_collection WHERE ent_id=b.ent_id AND pbl_id=b.pbl_id) p ON true WHERE b.ent_id=$1`;
@Injectable()
export class CollectionsService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly settings: TenantSettingsService,
  ) {}
  async statistics(u: AcmCurrentUser, q: { month: string; site?: string }) {
    return this.ds.transaction('REPEATABLE READ', (m) =>
      topStatistics(m, u.entId, q.month, q.site || 'ALL', BILL_SELECT),
    );
  }
  async monthly(u: AcmCurrentUser, q: MonthlyPayQuery, exportAll = false) {
    const result = await this.ds.transaction('REPEATABLE READ', (m) =>
      monthlyPay(m, u.entId, q, BILL_SELECT, exportAll),
    );
    if (exportAll && result.total > 10000) this.error('PAY_EXPORT_LIMIT');
    return result;
  }
  private error(code: string): never {
    throw new BadRequestException(code);
  }
  private key(x: BillInput) {
    return createHash('sha256')
      .update(
        [
          x.studentId,
          x.classId || '',
          x.month,
          x.kind,
          x.title.trim().toLocaleLowerCase(),
        ].join('|'),
      )
      .digest('hex');
  }
  private async atomic(
    u: AcmCurrentUser,
    requestId: string,
    payload: unknown,
    work: (m: EntityManager) => Promise<unknown>,
  ) {
    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    return this.ds.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        u.entId + requestId,
      ]);
      const [old]: { req_hash: string; req_result: unknown }[] = await m.query(
        'SELECT req_hash,req_result FROM amb_acm_pay_request WHERE ent_id=$1 AND req_id=$2',
        [u.entId, requestId],
      );
      if (old) {
        if (old.req_hash !== hash)
          throw new ConflictException('PAY_REQUEST_MISMATCH');
        return old.req_result;
      }
      const result = await work(m);
      await m.query(
        'INSERT INTO amb_acm_pay_request(ent_id,req_id,req_hash,req_result) VALUES($1,$2,$3,$4)',
        [u.entId, requestId, hash, JSON.stringify(result)],
      );
      return result;
    });
  }
  private async audit(
    m: EntityManager,
    u: AcmCurrentUser,
    id: string,
    action: string,
    before: unknown,
    after: unknown,
    reason: string,
  ) {
    if (!reason.trim()) this.error('PAY_REASON_REQUIRED');
    await m.query(
      'INSERT INTO amb_acm_pay_bill_audit(ent_id,pbl_id,pbu_action,pbu_before,pbu_after,pbu_reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        u.entId,
        id,
        action,
        JSON.stringify(before),
        JSON.stringify(after),
        reason.trim(),
        u.id,
      ],
    );
  }
  private async lock(
    m: EntityManager,
    u: AcmCurrentUser,
    id: string,
    version: number,
    allowCanceled = false,
  ): Promise<BillRow> {
    const rows: unknown[] = await m.query(
      'SELECT pbl_id FROM amb_acm_pay_bill WHERE ent_id=$1 AND pbl_id=$2 FOR UPDATE',
      [u.entId, id],
    );
    if (!rows.length) throw new NotFoundException('PAY_BILL_NOT_FOUND');
    const [b]: BillRow[] = await m.query(BILL_SELECT + ' AND b.pbl_id=$2', [
      u.entId,
      id,
    ]);
    if (b.version !== version)
      throw new ConflictException('PAY_VERSION_CONFLICT');
    if (!allowCanceled && b.state === 'DRAFT')
      this.error('PAY_DRAFT_NOT_READY');
    if (!allowCanceled && b.state !== 'ACTIVE') this.error('PAY_BILL_CANCELED');
    return b;
  }
  private async touch(m: EntityManager, ent: string, id: string) {
    await m.query(
      'UPDATE amb_acm_pay_bill SET pbl_version=pbl_version+1,updated_at=now() WHERE ent_id=$1 AND pbl_id=$2',
      [ent, id],
    );
  }
  private async candidate(m: EntityManager, ent: string, x: BillInput) {
    if (!x.title.trim() || x.discount > x.amount)
      this.error('PAY_INVALID_AMOUNT');
    const [s]: { name: string; site: string; status: string }[] = await m.query(
      'SELECT std_name AS name,std_site AS site,std_status AS status FROM amb_acm_std_student WHERE ent_id=$1 AND std_id=$2 AND deleted_at IS NULL',
      [ent, x.studentId],
    );
    if (!s) this.error('PAY_STUDENT_NOT_FOUND');
    if (x.classId) {
      const c: unknown[] = await m.query(
        'SELECT cls_id FROM amb_acm_cls_classes WHERE ent_id=$1 AND cls_id=$2 AND cls_deleted_at IS NULL',
        [ent, x.classId],
      );
      if (!c.length) this.error('PAY_CLASS_NOT_FOUND');
      const membership: unknown[] = await m.query(
        `SELECT 1 WHERE EXISTS(SELECT 1 FROM amb_acm_cls_enrollment ce WHERE ce.ent_id=$1 AND ce.std_id=$2 AND ce.cls_id=$3 AND ce.ce_status='CONFIRMED') OR EXISTS(SELECT 1 FROM amb_acm_cls_class_students cs LEFT JOIN amb_acm_csl_inquiry i ON i.ent_id=cs.ent_id AND i.inq_id=cs.cst_inq_id WHERE cs.ent_id=$1 AND cs.cls_id=$3 AND cs.cst_left_at IS NULL AND (cs.cst_student_user_id=$2 OR i.inq_std_id=$2))`,
        [ent, x.studentId, x.classId],
      );
      if (!membership.length) this.error('PAY_STUDENT_NOT_ENROLLED');
    }
    const [duplicate]: { id: string }[] = await m.query(
      'SELECT pbl_id AS id FROM amb_acm_pay_bill WHERE ent_id=$1 AND pbl_source_key=$2',
      [ent, this.key(x)],
    );
    return {
      student: s,
      existingId: duplicate?.id ?? null,
      reason: duplicate
        ? 'DUPLICATE'
        : s.status !== 'ACTIVE'
          ? 'INACTIVE'
          : null,
    };
  }
  async preview(u: AcmCurrentUser, d: BillBatchDto) {
    const seen = new Set<string>();
    const items = [];
    for (const item of d.items) {
      const c = await this.candidate(this.ds.manager, u.entId, item);
      const key = this.key(item);
      items.push({
        ...item,
        studentName: c.student.name,
        existingId: c.existingId,
        reason: seen.has(key) ? 'DUPLICATE' : c.reason,
      });
      seen.add(key);
    }
    return { items, eligible: items.filter((x) => !x.reason).length };
  }
  private async draftCandidates(m: EntityManager, ent: string) {
    const rows: { id: string; name: string; site: string | null }[] =
      await m.query(
        "SELECT std_id AS id,std_name AS name,std_site AS site FROM amb_acm_std_student WHERE ent_id=$1 AND deleted_at IS NULL AND std_status='ACTIVE' ORDER BY std_id FOR SHARE",
        [ent],
      );
    return rows;
  }
  async activeDrafts(
    u: AcmCurrentUser,
    d: ActiveDraftBatchDto,
    commit: boolean,
  ) {
    if (!d.title.trim()) this.error('PAY_INVALID_AMOUNT');
    if (d.roster === 'MONTH' && !/^20\d{2}-(0[1-9]|1[0-2])$/.test(d.month))
      this.error('PAY_INVALID_RANGE');
    const work = async (m: EntityManager) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        u.entId + ':bills',
      ]);
      let students = await this.draftCandidates(m, u.entId);
      if (d.roster === 'MONTH') {
        // Lock student masters before deriving historic membership, as with current batches.
        await m.query(
          'SELECT std_id FROM amb_acm_std_student WHERE ent_id=$1 AND deleted_at IS NULL ORDER BY std_id FOR SHARE',
          [u.entId],
        );
        const roster = await monthlyStudents(
          m,
          u.entId,
          d.month,
          d.site || 'ALL',
        );
        students = roster
          .filter((s) => s.enrolled && !s.review)
          .map((s) => ({
            id: s.id,
            name: s.name,
            site:
              s.periods
                .slice()
                .sort((a, b) => (b.start || '').localeCompare(a.start || ''))[0]
                ?.site ?? null,
          }));
      } else students = students.filter((s) => siteMatches(s.site, d.site));
      if (d.studentId) students = students.filter((s) => s.id === d.studentId);
      const existing: { studentId: string }[] = await m.query(
        'SELECT DISTINCT std_id AS "studentId" FROM amb_acm_pay_bill WHERE ent_id=$1 AND pbl_month=$2 AND pbl_kind=\'CLASS\'',
        [u.entId, d.month],
      );
      const seen = new Set(existing.map((b) => b.studentId));
      const eligible = students.filter((s) => !seen.has(s.id));
      const ids: string[] = [];
      if (commit)
        for (const s of eligible) {
          const [row]: { id: string }[] = await m.query(
            "INSERT INTO amb_acm_pay_bill(ent_id,std_id,pbl_site,pbl_month,pbl_kind,pbl_title,pbl_amount,pbl_due,pbl_status,pbl_source_key,created_by) VALUES($1,$2,$3,$4,'CLASS',$5,NULL,NULL,'DRAFT',$6,$7) RETURNING pbl_id AS id",
            [
              u.entId,
              s.id,
              s.site,
              d.month,
              d.title.trim(),
              `active-draft:${s.id}:${d.month}`,
              u.id,
            ],
          );
          await this.audit(
            m,
            u,
            row.id,
            'CREATE_DRAFT',
            null,
            {
              studentId: s.id,
              month: d.month,
              title: d.title,
              amount: null,
              due: null,
            },
            'CREATE_DRAFT',
          );
          ids.push(row.id);
        }
      return {
        total: students.length,
        eligible: eligible.length,
        skipped: students.length - eligible.length,
        created: ids.length,
        month: d.month,
      };
    };
    return commit
      ? this.atomic(u, d.requestId, ['activeDrafts', d], work)
      : this.ds.transaction(work);
  }
  async create(u: AcmCurrentUser, d: BillBatchDto) {
    return this.atomic(u, d.requestId, ['create', d], async (m) => {
      // Serialize bill generation per tenant so concurrent requests cannot duplicate source keys.
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        u.entId + ':bills',
      ]);
      const ids: string[] = [];
      const skipped: { studentId: string; reason: string }[] = [];
      for (const x of d.items) {
        const c = await this.candidate(m, u.entId, x);
        if (c.reason) {
          skipped.push({ studentId: x.studentId, reason: c.reason });
          continue;
        }
        const [row]: { id: string }[] = await m.query(
          `INSERT INTO amb_acm_pay_bill(ent_id,std_id,cls_id,pbl_site,pbl_month,pbl_due,pbl_kind,pbl_title,pbl_amount,pbl_discount,pbl_memo,pbl_source_key,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING pbl_id AS id`,
          [
            u.entId,
            x.studentId,
            x.classId || null,
            c.student.site,
            x.month,
            x.due,
            x.kind,
            x.title.trim(),
            x.amount,
            x.discount,
            x.memo || '',
            this.key(x),
            u.id,
          ],
        );
        await this.audit(m, u, row.id, 'CREATE', null, x, 'CREATE');
        ids.push(row.id);
      }
      return { ids, skipped };
    });
  }
  async edit(u: AcmCurrentUser, d: EditBatchDto) {
    return this.atomic(u, d.requestId, ['edit', d], async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        u.entId + ':bills',
      ]);
      if (new Set(d.items.map((x) => x.id)).size !== d.items.length)
        this.error('PAY_DUPLICATE_ID');
      for (const x of [...d.items].sort((a, b) => a.id.localeCompare(b.id))) {
        const b = await this.lock(m, u, x.id, x.version, true);
        if (b.state === 'CANCELED') this.error('PAY_BILL_CANCELED');
        if (
          !x.title.trim() ||
          x.discount > x.amount ||
          x.amount - x.discount - b.adjustment < b.received ||
          x.amount - x.discount - b.adjustment < 0
        )
          this.error('PAY_BELOW_RECEIVED');
        const key = this.key({
          studentId: b.studentId,
          classId: b.classId ?? undefined,
          month: b.month,
          kind: b.kind,
          title: x.title,
          amount: x.amount,
          discount: x.discount,
          due: x.due,
        });
        const duplicate: unknown[] = await m.query(
          'SELECT 1 FROM amb_acm_pay_bill WHERE ent_id=$1 AND pbl_source_key=$2 AND pbl_id<>$3',
          [u.entId, key, b.id],
        );
        if (duplicate.length) throw new ConflictException('PAY_DUPLICATE_BILL');
        await m.query(
          "UPDATE amb_acm_pay_bill SET pbl_status='ACTIVE',pbl_amount=$3,pbl_discount=$4,pbl_due=$5,pbl_title=$6,pbl_memo=$7,pbl_source_key=$8,pbl_version=pbl_version+1,updated_at=now() WHERE ent_id=$1 AND pbl_id=$2",
          [
            u.entId,
            b.id,
            x.amount,
            x.discount,
            x.due,
            x.title.trim(),
            x.memo,
            key,
          ],
        );
        await this.audit(m, u, b.id, 'EDIT', b, x, d.reason);
      }
      return { updated: d.items.length };
    });
  }
  async collect(u: AcmCurrentUser, id: string, d: CollectionDto) {
    return this.atomic(u, d.requestId, ['collect', id, d], async (m) => {
      const b = await this.lock(m, u, id, d.version);
      if (d.amount > (b.unpaid ?? 0)) this.error('PAY_OVERPAYMENT');
      const [r]: { id: string }[] = await m.query(
        `INSERT INTO amb_acm_pay_collection(ent_id,pbl_id,pcl_type,pcl_amount,pcl_date,pcl_method,pcl_reason,created_by) VALUES($1,$2,'PAYMENT',$3,$4,$5,$6,$7) RETURNING pcl_id AS id`,
        [u.entId, id, d.amount, d.date, d.method, d.reason, u.id],
      );
      await this.touch(m, u.entId, id);
      await this.audit(
        m,
        u,
        id,
        'PAYMENT',
        b,
        { ...d, collectionId: r.id },
        d.reason,
      );
      return r;
    });
  }
  async refund(u: AcmCurrentUser, id: string, d: RefundDto) {
    return this.atomic(u, d.requestId, ['refund', id, d], async (m) => {
      const b = await this.lock(m, u, id, d.version);
      const [original]: {
        amount: number;
        method: string;
        remaining: number;
      }[] = await m.query(
        `SELECT o.pcl_amount::float8 AS amount,o.pcl_method AS method,(o.pcl_amount-COALESCE((SELECT sum(r.pcl_amount) FROM amb_acm_pay_collection r WHERE r.ent_id=o.ent_id AND r.pcl_original_id=o.pcl_id),0))::float8 AS remaining FROM amb_acm_pay_collection o WHERE o.ent_id=$1 AND o.pbl_id=$2 AND o.pcl_id=$3 AND o.pcl_type='PAYMENT'`,
        [u.entId, id, d.originalId],
      );
      if (!original || d.amount > original.remaining)
        this.error('PAY_REFUND_EXCEEDS_PAYMENT');
      if (d.type === 'REVERSAL' && d.reduceBill)
        this.error('PAY_INVALID_REVERSAL');
      if (d.reduceBill && d.amount > (b.net ?? 0))
        this.error('PAY_INVALID_ADJUSTMENT');
      const [r]: { id: string }[] = await m.query(
        'INSERT INTO amb_acm_pay_collection(ent_id,pbl_id,pcl_type,pcl_amount,pcl_date,pcl_method,pcl_original_id,pcl_reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING pcl_id AS id',
        [
          u.entId,
          id,
          d.type,
          d.amount,
          d.date,
          original.method,
          d.originalId,
          d.reason,
          u.id,
        ],
      );
      if (d.reduceBill)
        await m.query(
          'INSERT INTO amb_acm_pay_bill_adjustment(ent_id,pbl_id,pba_amount,pba_reason,pcl_id,created_by) VALUES($1,$2,$3,$4,$5,$6)',
          [u.entId, id, d.amount, d.reason, r.id, u.id],
        );
      await this.touch(m, u.entId, id);
      await this.audit(
        m,
        u,
        id,
        d.type,
        b,
        { ...d, collectionId: r.id },
        d.reason,
      );
      return r;
    });
  }
  async adjust(u: AcmCurrentUser, id: string, d: AdjustmentDto) {
    return this.atomic(u, d.requestId, ['adjust', id, d], async (m) => {
      const b = await this.lock(m, u, id, d.version);
      if (
        !d.amount ||
        b.adjustment + d.amount < 0 ||
        (b.net ?? 0) - d.amount < b.received ||
        (b.net ?? 0) - d.amount < 0
      )
        this.error('PAY_INVALID_ADJUSTMENT');
      await m.query(
        'INSERT INTO amb_acm_pay_bill_adjustment(ent_id,pbl_id,pba_amount,pba_reason,created_by) VALUES($1,$2,$3,$4,$5)',
        [u.entId, id, d.amount, d.reason, u.id],
      );
      await this.touch(m, u.entId, id);
      await this.audit(m, u, id, 'ADJUSTMENT', b, d, d.reason);
      return { id };
    });
  }
  async state(
    u: AcmCurrentUser,
    id: string,
    d: BillActionDto,
    restore: boolean,
  ) {
    return this.atomic(u, d.requestId, ['state', id, d, restore], async (m) => {
      const b = await this.lock(m, u, id, d.version, true);
      if (
        (restore && b.state !== 'CANCELED') ||
        (!restore && !['ACTIVE', 'DRAFT'].includes(b.state))
      )
        this.error('PAY_INVALID_STATE');
      if (!restore && b.paid > 0) this.error('PAY_HAS_COLLECTIONS');
      await m.query(
        'UPDATE amb_acm_pay_bill SET pbl_status=$3,pbl_version=pbl_version+1,updated_at=now() WHERE ent_id=$1 AND pbl_id=$2',
        [
          u.entId,
          id,
          restore ? (b.amount === null ? 'DRAFT' : 'ACTIVE') : 'CANCELED',
        ],
      );
      await this.audit(
        m,
        u,
        id,
        restore ? 'RESTORE' : 'CANCEL',
        b,
        {
          state: restore
            ? b.amount === null
              ? 'DRAFT'
              : 'ACTIVE'
            : 'CANCELED',
        },
        d.reason,
      );
      return { id };
    });
  }
  async stateBatch(u: AcmCurrentUser, d: StateBatchDto) {
    return this.atomic(u, d.requestId, ['stateBatch', d], async (m) => {
      if (new Set(d.items.map((x) => x.id)).size !== d.items.length)
        this.error('PAY_DUPLICATE_ID');
      for (const x of [...d.items].sort((a, b) => a.id.localeCompare(b.id))) {
        const b = await this.lock(m, u, x.id, x.version, true);
        if (
          (d.restore && b.state !== 'CANCELED') ||
          (!d.restore && !['ACTIVE', 'DRAFT'].includes(b.state))
        )
          this.error('PAY_INVALID_STATE');
        if (!d.restore && b.paid > 0) this.error('PAY_HAS_COLLECTIONS');
        await m.query(
          'UPDATE amb_acm_pay_bill SET pbl_status=$3,pbl_version=pbl_version+1,updated_at=now() WHERE ent_id=$1 AND pbl_id=$2',
          [
            u.entId,
            x.id,
            d.restore ? (b.amount === null ? 'DRAFT' : 'ACTIVE') : 'CANCELED',
          ],
        );
        await this.audit(
          m,
          u,
          x.id,
          d.restore ? 'RESTORE' : 'CANCEL',
          b,
          {
            state: d.restore
              ? b.amount === null
                ? 'DRAFT'
                : 'ACTIVE'
              : 'CANCELED',
          },
          d.reason,
        );
      }
      return { updated: d.items.length };
    });
  }
  private async filter(ent: string, q: BillQuery) {
    for (const value of [q.from, q.to]) {
      if (value?.length === 10) {
        const parsed = new Date(value + 'T00:00:00Z');
        if (
          Number.isNaN(parsed.getTime()) ||
          parsed.toISOString().slice(0, 10) !== value
        )
          this.error('PAY_INVALID_RANGE');
      }
    }
    if (q.dueFrom && q.dueTo && q.dueFrom > q.dueTo)
      this.error('PAY_INVALID_RANGE');
    const tz = await this.settings.getTimezone(ent);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const values: unknown[] = [ent, today];
    const clauses: string[] = ['$2::text IS NOT NULL'];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      clauses.push(sql.replace('?', `$${values.length}`));
    };
    clauses.push(
      q.canceled === 'true'
        ? "v.state='CANCELED'"
        : "v.state IN ('ACTIVE','DRAFT')",
    );
    if (q.basis === 'PAYMENT') {
      if (!q.from || !q.to || q.from.length !== 10 || q.to.length !== 10)
        this.error('PAY_DATE_RANGE_REQUIRED');
      values.push(q.from, q.to);
      clauses.push(
        `EXISTS(SELECT 1 FROM amb_acm_pay_collection x WHERE x.ent_id=$1 AND x.pbl_id=v.id AND x.pcl_date BETWEEN $${values.length - 1}::date AND $${values.length}::date)`,
      );
    } else {
      if (q.from)
        add(
          q.previous === 'true' ? '(v.month>=? OR v.unpaid>0)' : 'v.month>=?',
          q.from.slice(0, 7),
        );
      if (q.to) add('v.month<=?', q.to.slice(0, 7));
    }
    if (q.from && q.to && q.from > q.to) this.error('PAY_INVALID_RANGE');
    for (const [key, col] of [
      ['studentId', '"studentId"'],
      ['classId', '"classId"'],
      ['teacherId', '"teacherId"'],
      ['site', 'site'],
      ['grade', 'grade'],
      ['studentStatus', '"studentStatus"'],
      ['kind', 'kind'],
    ] as const)
      if (q[key]) {
        if (key === 'site' && q[key] === 'UNASSIGNED')
          clauses.push('v.site IS NULL');
        else add(`v.${col}=?`, q[key]);
      }
    if (q.q) add('v."studentName" ILIKE ?', `%${q.q}%`);
    if (q.school) add('v.school ILIKE ?', `%${q.school}%`);
    if (q.memo) add('v.memo ILIKE ?', `%${q.memo}%`);
    if (q.dueFrom) add('v.due>=?', q.dueFrom);
    if (q.dueTo) add('v.due<=?', q.dueTo);
    if (q.method) add('?=ANY(v.methods)', q.method);
    if (q.status === 'OVERDUE') clauses.push('v.unpaid>0 AND v.due<$2');
    else if (q.status) add('v.status=?', q.status);
    let period = '0::float8';
    if (q.basis === 'PAYMENT') {
      values.push(q.from, q.to);
      period = `COALESCE((SELECT sum(CASE WHEN x.pcl_type='PAYMENT' THEN x.pcl_amount ELSE -x.pcl_amount END) FROM amb_acm_pay_collection x WHERE x.ent_id=$1 AND x.pbl_id=v.id AND x.pcl_date BETWEEN $${values.length - 1}::date AND $${values.length}::date),0)::float8`;
    }
    const sql = `WITH base AS (${BILL_SELECT}), v AS (SELECT base.*,CASE WHEN amount IS NULL THEN 'DRAFT' WHEN net=0 THEN 'FREE' WHEN unpaid=0 THEN 'PAID' WHEN received>0 THEN 'PARTIAL' ELSE 'UNPAID' END AS status FROM base) SELECT v.*,${period} AS "periodReceived" FROM v WHERE ${clauses.join(' AND ')}`;
    return { sql, values, today };
  }
  async list(u: AcmCurrentUser, q: BillQuery, exportAll = false) {
    const { sql, values, today } = await this.filter(u.entId, q);
    return this.ds.transaction('REPEATABLE READ', async (m) => {
      const [summary]: Record<string, number>[] = await m.query(
        `SELECT count(*)::int AS count,count(*) FILTER(WHERE status='DRAFT')::int AS drafts,COALESCE(sum(amount),0)::float8 AS amount,COALESCE(sum(discount) FILTER(WHERE status<>'DRAFT'),0)::float8 AS discount,COALESCE(sum(adjustment),0)::float8 AS adjustment,COALESCE(sum(net),0)::float8 AS net,COALESCE(sum(paid),0)::float8 AS paid,COALESCE(sum(refunded),0)::float8 AS refunded,COALESCE(sum(received),0)::float8 AS received,COALESCE(sum(unpaid),0)::float8 AS unpaid,COALESCE(sum("periodReceived"),0)::float8 AS "periodReceived" FROM (${sql}) filtered`,
        values,
      );
      if (exportAll && summary.count > 10000) this.error('PAY_EXPORT_LIMIT');
      const items: BillRow[] = await m.query(
        `${sql} ORDER BY v.month DESC,v."studentName",v.id LIMIT ${exportAll ? 10000 : 50} OFFSET ${exportAll ? 0 : ((q.page ?? 1) - 1) * 50}`,
        values,
      );
      return { items, summary, page: q.page ?? 1, today };
    });
  }
  async detail(u: AcmCurrentUser, id: string) {
    return this.ds.transaction('REPEATABLE READ', async (m) => {
      const [bill]: BillRow[] = await m.query(
        BILL_SELECT + ' AND b.pbl_id=$2',
        [u.entId, id],
      );
      if (!bill) throw new NotFoundException('PAY_BILL_NOT_FOUND');
      const collections: {
        id: string;
        type: string;
        amount: number;
        date: string;
        method: string;
        originalId: string | null;
        reason: string;
        actor: string | null;
        createdAt: Date;
        remaining: number;
      }[] = await m.query(
        `SELECT x.pcl_id AS id,x.pcl_type AS type,x.pcl_amount::float8 AS amount,x.pcl_date::text AS date,x.pcl_method AS method,x.pcl_original_id AS "originalId",x.pcl_reason AS reason,u.usr_name AS actor,x.created_at AS "createdAt",(x.pcl_amount-COALESCE((SELECT sum(r.pcl_amount) FROM amb_acm_pay_collection r WHERE r.ent_id=x.ent_id AND r.pcl_original_id=x.pcl_id),0))::float8 AS remaining FROM amb_acm_pay_collection x LEFT JOIN amb_acm_user u ON u.ent_id=x.ent_id AND u.usr_id=x.created_by WHERE x.ent_id=$1 AND x.pbl_id=$2 ORDER BY x.created_at,x.pcl_id`,
        [u.entId, id],
      );
      const audit: {
        id: string;
        action: string;
        before: unknown;
        after: unknown;
        reason: string;
        actor: string | null;
        createdAt: Date;
      }[] = await m.query(
        'SELECT a.pbu_id AS id,a.pbu_action AS action,a.pbu_before AS before,a.pbu_after AS after,a.pbu_reason AS reason,a.created_at AS "createdAt",u.usr_name AS actor FROM amb_acm_pay_bill_audit a LEFT JOIN amb_acm_user u ON u.ent_id=a.ent_id AND u.usr_id=a.created_by WHERE a.ent_id=$1 AND a.pbl_id=$2 ORDER BY a.created_at DESC',
        [u.entId, id],
      );
      const consultation: {
        id: string;
        tuition: string | null;
        paid: string | null;
        date: string | null;
        approved: boolean | null;
      }[] = await m.query(
        `SELECT i.inq_id AS id,e.enr_tuition_amount AS tuition,e.enr_payment_amount AS paid,e.enr_payment_date::text AS date,e.enr_tuition_paid AS approved FROM amb_acm_csl_inquiry i JOIN amb_acm_csl_enrollment e ON e.ent_id=i.ent_id AND e.inq_id=i.inq_id WHERE i.ent_id=$1 AND i.inq_std_id=$2 AND i.deleted_at IS NULL`,
        [u.entId, bill.studentId],
      );
      return { bill, collections, audit, consultation };
    });
  }
  async options(u: AcmCurrentUser, q: BillQuery) {
    const students: {
      id: string;
      name: string;
      status: string;
      site: string | null;
    }[] = await this.ds.query(
      `SELECT s.std_id AS id,s.std_name AS name,s.std_status AS status,s.std_site AS site FROM amb_acm_std_student s WHERE s.ent_id=$1 AND s.deleted_at IS NULL AND s.std_name ILIKE $2 AND ($5::text='ALL' OR s.std_status=$5) AND ($3::text IS NULL OR COALESCE(s.std_site,'UNASSIGNED')=$3) AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM amb_acm_cls_enrollment ce WHERE ce.ent_id=s.ent_id AND ce.std_id=s.std_id AND ce.cls_id=$4 AND ce.ce_status='CONFIRMED') OR EXISTS(SELECT 1 FROM amb_acm_cls_class_students cs LEFT JOIN amb_acm_csl_inquiry i ON i.ent_id=cs.ent_id AND i.inq_id=cs.cst_inq_id WHERE cs.ent_id=s.ent_id AND cs.cls_id=$4 AND cs.cst_left_at IS NULL AND (cs.cst_student_user_id=s.std_id OR i.inq_std_id=s.std_id))) ORDER BY s.std_name,s.std_id LIMIT 101`,
      [
        u.entId,
        `%${q.q ?? ''}%`,
        q.site || null,
        q.classId || null,
        q.studentStatus || 'ACTIVE',
      ],
    );
    const classes: { id: string; name: string }[] = await this.ds.query(
      'SELECT cls_id AS id,COALESCE(cls_subject_label,cls_code) AS name FROM amb_acm_cls_classes WHERE ent_id=$1 AND cls_deleted_at IS NULL ORDER BY name',
      [u.entId],
    );
    const teachers: { id: string; name: string }[] = await this.ds.query(
      'SELECT tch_id AS id,tch_name AS name FROM amb_acm_tch_teacher WHERE ent_id=$1 AND deleted_at IS NULL ORDER BY tch_name',
      [u.entId],
    );
    return {
      students: students.slice(0, 100),
      hasMore: students.length > 100,
      classes,
      teachers,
    };
  }
}
