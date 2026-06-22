import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import {
  PayReceiptType,
  PayReceiptTypeormEntity,
} from '../../infrastructure/typeorm/pay-receipt.typeorm-entity';

/**
 * 영수증 발급 + 취소 — 간이/현금영수증 한정.
 *
 * `buyerIdentifier` 는 AES-GCM 으로 암호화된 BYTEA. 본 서비스는 raw byte
 * 만 다루고 평문 변환은 NTS 호출 직전에만 (AesGcmService) 메모리에서.
 *
 * 세금계산서는 별도 `PayTaxInvoiceService` — 다른 NTS API 호출 경로.
 */
@Injectable()
export class PayReceiptService {
  constructor(
    @InjectRepository(PayReceiptTypeormEntity, ACM_DS)
    private readonly repo: Repository<PayReceiptTypeormEntity>,
  ) {}

  async findById(id: string): Promise<PayReceiptTypeormEntity> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'PAY_RECEIPT_NOT_FOUND', id });
    return row;
  }

  async listForOrder(orderId: string): Promise<PayReceiptTypeormEntity[]> {
    return this.repo.find({
      where: { orderId },
      order: { issuedAt: 'DESC' },
    });
  }

  async issue(input: {
    orderId: string;
    receiptType: PayReceiptType;
    issuedAt?: Date;
    pdfUrl?: string | null;
    cashReceiptNo?: string | null;
    buyerIdentifier?: Buffer | null;
  }): Promise<PayReceiptTypeormEntity> {
    const row = this.repo.create({
      orderId: input.orderId,
      receiptType: input.receiptType,
      issuedAt: input.issuedAt ?? new Date(),
      pdfUrl: input.pdfUrl ?? null,
      cashReceiptNo: input.cashReceiptNo ?? null,
      buyerIdentifier: input.buyerIdentifier ?? null,
    });
    return this.repo.save(row);
  }

  async cancel(id: string): Promise<PayReceiptTypeormEntity> {
    const row = await this.findById(id);
    if (row.canceledAt) return row; // idempotent
    row.canceledAt = new Date();
    return this.repo.save(row);
  }
}
