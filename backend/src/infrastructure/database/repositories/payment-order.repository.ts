import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { PayOrderEntity } from '../entities/pay-order.entity';
import { PaymentOrder } from '../../../domain/entities/payment-order.js';
import type { IPaymentOrderRepository } from '../../../domain/repositories/payment-order-repository.interface.js';

@Injectable()
export class PaymentOrderRepository implements IPaymentOrderRepository {
  constructor(
    @InjectRepository(PayOrderEntity)
    private readonly repo: Repository<PayOrderEntity>,
  ) {}

  async findById(id: number): Promise<PaymentOrder | null> {
    const entity = await this.repo.findOne({
      where: { podId: id },
      relations: [
        'enrollment',
        'enrollment.student',
        'enrollment.appliedParent',
        'enrollment.class',
        'enrollment.class.program',
      ],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<PaymentOrder[]> {
    const entities = await this.repo.find({
      relations: [
        'enrollment',
        'enrollment.student',
        'enrollment.appliedParent',
        'enrollment.class',
        'enrollment.class.program',
      ],
      order: { podCreatedAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      enrollmentId?: number;
      method?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<PaymentOrder[]> {
    const qb = this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.enrollment', 'e')
      .leftJoinAndSelect('e.student', 's')
      .leftJoinAndSelect('e.appliedParent', 'p')
      .leftJoinAndSelect('e.class', 'c')
      .leftJoinAndSelect('c.program', 'prg')
      .where('o.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('o.pod_status = :status', { status: filters.status });
    }
    if (filters.enrollmentId) {
      qb.andWhere('o.enr_id = :enrollmentId', { enrollmentId: filters.enrollmentId });
    }
    if (filters.method) {
      qb.andWhere('o.pod_method = :method', { method: filters.method });
    }
    if (filters.dateFrom) {
      qb.andWhere('o.pod_created_at >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('o.pod_created_at <= :dateTo', { dateTo: `${filters.dateTo} 23:59:59` });
    }

    qb.orderBy('o.pod_created_at', 'DESC');

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async findByOrderNo(orderNo: string): Promise<PaymentOrder | null> {
    const entity = await this.repo.findOne({
      where: { podOrderNo: orderNo },
      relations: [
        'enrollment',
        'enrollment.student',
        'enrollment.appliedParent',
        'enrollment.class',
        'enrollment.class.program',
      ],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByIdempotencyKey(key: string): Promise<PaymentOrder | null> {
    const entity = await this.repo.findOne({
      where: { podIdempotencyKey: key },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByPgPaymentKey(pgPaymentKey: string): Promise<PaymentOrder | null> {
    const entity = await this.repo.findOne({
      where: { podPgPaymentKey: pgPaymentKey },
      relations: [
        'enrollment',
        'enrollment.student',
        'enrollment.appliedParent',
        'enrollment.class',
        'enrollment.class.program',
      ],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByEnrollmentId(enrollmentId: number): Promise<PaymentOrder[]> {
    const entities = await this.repo.find({
      where: { enrId: enrollmentId },
      order: { podCreatedAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async create(entity: Partial<PaymentOrder>): Promise<PaymentOrder> {
    const created = this.repo.create({
      acdId: entity.academyId!,
      enrId: entity.enrollmentId!,
      podOrderNo: entity.orderNo!,
      podIdempotencyKey: entity.idempotencyKey!,
      podAmount: String(entity.amount!),
      podCurrency: entity.currency ?? 'KRW',
      podMethod: entity.method ?? null,
      podPgProvider: entity.pgProvider ?? 'TOSS',
      podPgOrderId: entity.pgOrderId ?? null,
      podPgPaymentKey: entity.pgPaymentKey ?? null,
      podStatus: entity.status ?? 'READY',
      rfpId: entity.refundPolicyId!,
      podExpiresAt: entity.expiresAt ?? null,
      podApprovedAt: entity.approvedAt ?? null,
      podCanceledAt: entity.canceledAt ?? null,
    });
    const saved = await this.repo.save(created);
    const reloaded = await this.findById(saved.podId);
    if (!reloaded) {
      throw new Error('PaymentOrder creation failed');
    }
    return reloaded;
  }

  async update(id: number, entity: Partial<PaymentOrder>): Promise<PaymentOrder> {
    const updateData: Partial<PayOrderEntity> = {};

    if (entity.status !== undefined) updateData.podStatus = entity.status;
    if (entity.method !== undefined) updateData.podMethod = entity.method;
    if (entity.pgOrderId !== undefined) updateData.podPgOrderId = entity.pgOrderId;
    if (entity.pgPaymentKey !== undefined) updateData.podPgPaymentKey = entity.pgPaymentKey;
    if (entity.approvedAt !== undefined) updateData.podApprovedAt = entity.approvedAt;
    if (entity.canceledAt !== undefined) updateData.podCanceledAt = entity.canceledAt;

    if (Object.keys(updateData).length > 0) {
      await this.repo.update({ podId: id }, updateData);
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('PaymentOrder not found after update');
    }
    return updated;
  }

  async updateStatus(
    id: number,
    status: string,
    extra?: Partial<PaymentOrder>,
  ): Promise<PaymentOrder> {
    return this.update(id, { status, ...extra });
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ podId: id });
  }

  async findStalePendingOrders(olderThanMinutes: number): Promise<PaymentOrder[]> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const entities = await this.repo.find({
      where: {
        podStatus: In(['READY', 'IN_PROGRESS']),
        podUpdatedAt: LessThan(cutoff),
      },
      order: { podCreatedAt: 'ASC' },
      take: 50,
    });
    return entities.map((e) => this.toDomain(e));
  }

  private toDomain(entity: PayOrderEntity): PaymentOrder {
    const order = new PaymentOrder();
    order.id = entity.podId;
    order.academyId = entity.acdId;
    order.enrollmentId = entity.enrId;
    order.orderNo = entity.podOrderNo;
    order.idempotencyKey = entity.podIdempotencyKey;
    order.amount = Number(entity.podAmount);
    order.currency = entity.podCurrency;
    order.method = entity.podMethod;
    order.pgProvider = entity.podPgProvider;
    order.pgOrderId = entity.podPgOrderId;
    order.pgPaymentKey = entity.podPgPaymentKey;
    order.status = entity.podStatus;
    order.refundPolicyId = entity.rfpId;
    order.expiresAt = entity.podExpiresAt;
    order.approvedAt = entity.podApprovedAt;
    order.canceledAt = entity.podCanceledAt;
    order.createdAt = entity.podCreatedAt;
    order.updatedAt = entity.podUpdatedAt;

    // Joined fields via enrollment relations
    order.studentName = entity.enrollment?.student?.stdName ?? undefined;
    order.parentName = entity.enrollment?.appliedParent?.prtName ?? undefined;
    order.programName = entity.enrollment?.class?.program?.prgName ?? undefined;
    order.className = entity.enrollment?.class?.program?.prgName ?? undefined;
    return order;
  }
}
