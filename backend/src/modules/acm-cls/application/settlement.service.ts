import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { SettlementLineTypeormEntity } from '../infrastructure/typeorm/settlement-line.typeorm-entity';
import { SettlementTypeormEntity } from '../infrastructure/typeorm/settlement.typeorm-entity';
import type { ConfirmSettlementDto } from './dto/session.dto';

interface SourceRow {
  cls_id: string;
  ses_id: string;
  cst_id: string;
  ses_date: string;
  hours: string;
  rate: string;
  teacher_user_id: string;
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    @InjectRepository(SettlementTypeormEntity, ACM_DS)
    private readonly stlRepo: Repository<SettlementTypeormEntity>,
    @InjectRepository(SettlementLineTypeormEntity, ACM_DS)
    private readonly lineRepo: Repository<SettlementLineTypeormEntity>,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Recompute settlement for one teacher × month. Idempotent.
   * Skips if settlement is already CONFIRMED/EXPORTED/PAID (VR-CLS-X07).
   */
  async recomputeOne(entId: string, teacherUserId: string, yearMonth: string) {
    const existing = await this.stlRepo.findOne({
      where: { entId, teacherUserId, yearMonth },
    });
    if (existing && existing.status !== 'DRAFT') {
      return existing; // immutable
    }

    const [year, month] = yearMonth.split('-').map((x) => parseInt(x, 10));
    const from = `${yearMonth}-01`;
    const toDate = new Date(Date.UTC(year, month, 1)); // first day of next month
    const to = toDate.toISOString().slice(0, 10);

    // Pull HELD sessions + their attendance lines for this teacher in the month
    const rows = await this.ds.query<SourceRow[]>(
      `SELECT c.cls_id, s.ses_id, a.cst_id,
              to_char(s.ses_scheduled_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS ses_date,
              a.att_billable_hours::text AS hours,
              COALESCE(cst.cst_hourly_rate, 0)::text AS rate,
              c.cls_teacher_user_id AS teacher_user_id
         FROM amb_acm_cls_sessions s
         JOIN amb_acm_cls_classes c ON c.cls_id = s.cls_id AND c.cls_deleted_at IS NULL
         JOIN amb_acm_cls_attendance a ON a.ses_id = s.ses_id
         JOIN amb_acm_cls_class_students cst ON cst.cst_id = a.cst_id
        WHERE s.ent_id = $1
          AND c.cls_teacher_user_id = $2
          AND s.ses_status = 'HELD'
          AND s.ses_deleted_at IS NULL
          AND s.ses_scheduled_at >= ($3 || ' 00:00')::timestamptz AT TIME ZONE 'Asia/Seoul'
          AND s.ses_scheduled_at < ($4 || ' 00:00')::timestamptz AT TIME ZONE 'Asia/Seoul'
          AND a.att_billable_hours > 0`,
      [entId, teacherUserId, from, to],
    );

    let hoursTotal = 0;
    let amountGross = 0;
    const lines = rows.map((r) => {
      const hrs = Number(r.hours);
      const rate = Number(r.rate);
      const amount = Math.round(hrs * rate);
      hoursTotal += hrs;
      amountGross += amount;
      return {
        clsId: r.cls_id,
        sesId: r.ses_id,
        cstId: r.cst_id,
        sessionDate: r.ses_date,
        billableHours: hrs.toFixed(1),
        hourlyRate: rate.toFixed(0),
        amount: amount.toFixed(0),
      };
    });

    const withholdingRate = existing ? Number(existing.withholdingRate) : 0.033;
    const amountWithheld = Math.round(amountGross * withholdingRate);
    const amountAfterTax = amountGross - amountWithheld;
    const now = new Date();

    const result = await this.ds.transaction(async (em) => {
      let stl = existing;
      if (!stl) {
        stl = em.getRepository(SettlementTypeormEntity).create({
          id: randomUUID(),
          entId,
          teacherUserId,
          yearMonth,
          hoursTotal: '0',
          amountGross: '0',
          withholdingRate: withholdingRate.toFixed(4),
          amountWithheld: '0',
          amountAfterTax: '0',
          status: 'DRAFT',
          confirmedBy: null,
          confirmedAt: null,
          payrollExportId: null,
          computedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
      stl.hoursTotal = hoursTotal.toFixed(1);
      stl.amountGross = amountGross.toFixed(0);
      stl.amountWithheld = amountWithheld.toFixed(0);
      stl.amountAfterTax = amountAfterTax.toFixed(0);
      stl.computedAt = now;
      stl.updatedAt = now;
      const savedStl = await em
        .getRepository(SettlementTypeormEntity)
        .save(stl);

      // Replace lines
      await em
        .getRepository(SettlementLineTypeormEntity)
        .createQueryBuilder()
        .delete()
        .where('stl_id = :id', { id: savedStl.id })
        .execute();
      if (lines.length) {
        await em.getRepository(SettlementLineTypeormEntity).insert(
          lines.map((l) => ({
            id: randomUUID(),
            entId,
            stlId: savedStl.id,
            clsId: l.clsId,
            sesId: l.sesId,
            cstId: l.cstId,
            sessionDate: l.sessionDate,
            billableHours: l.billableHours,
            hourlyRate: l.hourlyRate,
            amount: l.amount,
            createdAt: now,
          })),
        );
      }
      return savedStl;
    });
    return result;
  }

  /** Recompute every teacher's settlement for an entity in a month. */
  async recomputeMonth(entId: string, yearMonth: string) {
    const teachers = await this.ds.query<{ teacher: string }[]>(
      `SELECT DISTINCT cls_teacher_user_id AS teacher
         FROM amb_acm_cls_classes
        WHERE ent_id = $1 AND cls_deleted_at IS NULL`,
      [entId],
    );
    let count = 0;
    for (const t of teachers) {
      await this.recomputeOne(entId, t.teacher, yearMonth);
      count += 1;
    }
    return { teachers: count };
  }

  async list(entId: string, yearMonth: string, teacherUserId?: string) {
    const where: Record<string, unknown> = { entId, yearMonth };
    if (teacherUserId) where.teacherUserId = teacherUserId;
    return this.stlRepo.find({ where, order: { teacherUserId: 'ASC' } });
  }

  async findOne(entId: string, id: string) {
    const stl = await this.stlRepo.findOne({ where: { id, entId } });
    if (!stl) throw new NotFoundException('Settlement not found');
    const lines = await this.lineRepo.find({
      where: { entId, stlId: id },
      order: { sessionDate: 'ASC' },
    });
    return { ...stl, lines };
  }

  async confirm(
    entId: string,
    id: string,
    dto: ConfirmSettlementDto,
    actorId?: string,
  ) {
    const stl = await this.stlRepo.findOne({ where: { id, entId } });
    if (!stl) throw new NotFoundException('Settlement not found');
    if (stl.status !== 'DRAFT')
      throw new BadRequestException('VAL_SETTLEMENT_FROZEN');

    const now = new Date();
    if (dto.withholdingRate !== undefined) {
      stl.withholdingRate = dto.withholdingRate.toFixed(4);
      const gross = Number(stl.amountGross);
      const w = Math.round(gross * dto.withholdingRate);
      stl.amountWithheld = w.toFixed(0);
      stl.amountAfterTax = (gross - w).toFixed(0);
    }
    stl.status = 'CONFIRMED';
    stl.confirmedAt = now;
    stl.confirmedBy = actorId ?? null;
    stl.updatedAt = now;
    const saved = await this.stlRepo.save(stl);
    this.events.emit('acm.cls.settlement.confirmed', {
      entId,
      occurredAt: now.toISOString(),
      actorId,
      stlId: id,
      teacherUserId: stl.teacherUserId,
      yearMonth: stl.yearMonth,
    });
    return saved;
  }

  /**
   * BR-CLS-010 — auto-confirm prior month's DRAFT settlements on the 5th.
   */
  async autoConfirmPrevMonth(): Promise<{ confirmed: number }> {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const yearMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const drafts = await this.stlRepo.find({
      where: { yearMonth, status: 'DRAFT' },
    });
    let count = 0;
    for (const d of drafts) {
      d.status = 'CONFIRMED';
      d.confirmedAt = now;
      d.confirmedBy = null; // SYSTEM
      d.updatedAt = now;
      await this.stlRepo.save(d);
      this.events.emit('acm.cls.settlement.confirmed', {
        entId: d.entId,
        occurredAt: now.toISOString(),
        actorId: 'SYSTEM',
        stlId: d.id,
        teacherUserId: d.teacherUserId,
        yearMonth: d.yearMonth,
        auto: true,
      });
      count += 1;
    }
    return { confirmed: count };
  }
}
