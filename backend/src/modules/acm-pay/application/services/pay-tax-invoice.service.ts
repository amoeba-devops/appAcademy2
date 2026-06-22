import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import {
  PayTaxInvoiceStatus,
  PayTaxInvoiceBuyerType,
  PayTaxInvoiceTypeormEntity,
} from '../../infrastructure/typeorm/pay-tax-invoice.typeorm-entity';

/**
 * 세금계산서 NTS eTax lifecycle:
 *   DRAFT → SUBMITTED → APPROVED                         (정상 흐름)
 *                    ↘ REJECTED                          (NTS 거부)
 *   any → CANCELED                                       (운영자 취소)
 *
 * 본 서비스는 상태 머신 + audit 트래킹만. 실제 NTS API 호출 (XML 작성·전송)
 * 은 별도 `infrastructure/external/nts/` 모듈이 담당하며, 결과 (issue_no /
 * error_code / submitted_at / approved_at) 만 본 서비스에 반영한다.
 */
@Injectable()
export class PayTaxInvoiceService {
  constructor(
    @InjectRepository(PayTaxInvoiceTypeormEntity, ACM_DS)
    private readonly repo: Repository<PayTaxInvoiceTypeormEntity>,
  ) {}

  async findById(entId: string, id: string): Promise<PayTaxInvoiceTypeormEntity> {
    const row = await this.repo.findOne({ where: { entId, id } });
    if (!row) throw new NotFoundException({ code: 'PAY_TAX_INVOICE_NOT_FOUND', id });
    return row;
  }

  /**
   * Draft a new tax invoice. Idempotency-by-invoiceNo enforced by the
   * UNIQUE(ent_id, invoice_no) constraint — caller computes the next
   * `academy-YYYY-seq` sequence number externally (typically via a
   * per-tenant counter table).
   */
  async createDraft(input: {
    entId: string;
    orderId: string;
    invoiceNo: string;
    supplierBizNo: string;
    buyerType: PayTaxInvoiceBuyerType;
    buyerBizNo?: string | null;
    supplyAmount: number;
    taxAmount: number;
    issueDate: string;
  }): Promise<PayTaxInvoiceTypeormEntity> {
    const row = this.repo.create({
      entId: input.entId,
      orderId: input.orderId,
      invoiceNo: input.invoiceNo,
      supplierBizNo: input.supplierBizNo,
      buyerType: input.buyerType,
      buyerBizNo: input.buyerBizNo ?? null,
      supplyAmount: input.supplyAmount,
      taxAmount: input.taxAmount,
      totalAmount: input.supplyAmount + input.taxAmount,
      issueDate: input.issueDate,
      status: 'DRAFT',
    });
    return this.repo.save(row);
  }

  async markSubmitted(entId: string, id: string): Promise<PayTaxInvoiceTypeormEntity> {
    const row = await this.findById(entId, id);
    row.status = 'SUBMITTED';
    row.ntsSubmittedAt = new Date();
    row.ntsErrorCode = null;
    row.ntsErrorMessage = null;
    return this.repo.save(row);
  }

  async markApproved(
    entId: string,
    id: string,
    ntsIssueNo: string,
    xmlPayloadUrl?: string | null,
    pdfUrl?: string | null,
  ): Promise<PayTaxInvoiceTypeormEntity> {
    const row = await this.findById(entId, id);
    row.status = 'APPROVED';
    row.ntsApprovedAt = new Date();
    row.ntsIssueNo = ntsIssueNo;
    if (xmlPayloadUrl !== undefined) row.xmlPayloadUrl = xmlPayloadUrl;
    if (pdfUrl !== undefined) row.pdfUrl = pdfUrl;
    return this.repo.save(row);
  }

  async markRejected(
    entId: string,
    id: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<PayTaxInvoiceTypeormEntity> {
    const row = await this.findById(entId, id);
    row.status = 'REJECTED';
    row.ntsErrorCode = errorCode;
    row.ntsErrorMessage = errorMessage;
    return this.repo.save(row);
  }

  async cancel(entId: string, id: string): Promise<PayTaxInvoiceTypeormEntity> {
    const row = await this.findById(entId, id);
    if (row.status === 'CANCELED') return row; // idempotent
    row.status = 'CANCELED';
    return this.repo.save(row);
  }

  /**
   * Operator dashboard / NTS resubmit job pickup — invoices stuck in
   * SUBMITTED but never APPROVED beyond a deadline.
   */
  async listByStatus(
    entId: string,
    status: PayTaxInvoiceStatus,
    limit = 50,
  ): Promise<PayTaxInvoiceTypeormEntity[]> {
    return this.repo.find({
      where: { entId, status },
      order: { ntsSubmittedAt: 'ASC' },
      take: limit,
    });
  }
}
