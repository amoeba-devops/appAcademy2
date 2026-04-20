import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayReceiptEntity } from '../entities/pay-receipt.entity';
import { Receipt } from '../../../domain/entities/receipt.js';
import type { IReceiptRepository } from '../../../domain/repositories/receipt-repository.interface.js';

@Injectable()
export class ReceiptRepository implements IReceiptRepository {
  constructor(
    @InjectRepository(PayReceiptEntity)
    private readonly repo: Repository<PayReceiptEntity>,
  ) {}

  async findByAcademyId(academyId: number): Promise<Receipt[]> {
    const entities = await this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.order', 'o')
      .leftJoin('o.enrollment', 'e')
      .leftJoin('e.student', 's')
      .where('o.acd_id = :academyId', { academyId })
      .orderBy('r.rct_issued_at', 'DESC')
      .getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async findById(id: number): Promise<Receipt | null> {
    const entity = await this.repo.findOne({
      where: { rctId: id },
      relations: ['order', 'order.enrollment', 'order.enrollment.student'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByOrderId(orderId: number): Promise<Receipt[]> {
    const entities = await this.repo.find({
      where: { podId: orderId },
      relations: ['order'],
      order: { rctIssuedAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  private toDomain(entity: PayReceiptEntity): Receipt {
    const r = new Receipt();
    r.id = entity.rctId;
    r.orderId = entity.podId;
    r.receiptType = entity.rctReceiptType;
    r.issuedAt = entity.rctIssuedAt;
    r.pdfUrl = entity.rctPdfUrl;
    r.cashReceiptNo = entity.rctCashReceiptNo;
    r.canceledAt = entity.rctCanceledAt;
    r.orderNo = entity.order?.podOrderNo ?? undefined;
    r.studentName = entity.order?.enrollment?.student?.stdName ?? undefined;
    r.amount = entity.order?.podAmount ? Number(entity.order.podAmount) : undefined;
    return r;
  }
}
