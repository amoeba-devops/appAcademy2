import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayTaxInvoiceEntity } from '../entities/pay-tax-invoice.entity';
import { TaxInvoice } from '../../../domain/entities/tax-invoice.js';
import type { ITaxInvoiceRepository } from '../../../domain/repositories/tax-invoice-repository.interface.js';

@Injectable()
export class TaxInvoiceRepository implements ITaxInvoiceRepository {
  constructor(
    @InjectRepository(PayTaxInvoiceEntity)
    private readonly repo: Repository<PayTaxInvoiceEntity>,
  ) {}

  async findById(id: number): Promise<TaxInvoice | null> {
    const entity = await this.repo.findOne({
      where: { txiId: id },
      relations: ['order', 'order.enrollment', 'order.enrollment.student', 'order.enrollment.class', 'order.enrollment.class.program'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; dateFrom?: string; dateTo?: string },
  ): Promise<TaxInvoice[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.order', 'o')
      .leftJoinAndSelect('o.enrollment', 'e')
      .leftJoinAndSelect('e.student', 's')
      .leftJoinAndSelect('e.class', 'c')
      .leftJoinAndSelect('c.program', 'prg')
      .where('t.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('t.txi_status = :status', { status: filters.status });
    }
    if (filters.dateFrom) {
      qb.andWhere('t.txi_issue_date >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('t.txi_issue_date <= :dateTo', { dateTo: filters.dateTo });
    }

    qb.orderBy('t.txi_created_at', 'DESC');

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async findByOrderId(orderId: number): Promise<TaxInvoice[]> {
    const entities = await this.repo.find({
      where: { podId: orderId },
      order: { txiCreatedAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findPendingSubmission(): Promise<TaxInvoice[]> {
    const entities = await this.repo.find({
      where: { txiStatus: 'DRAFT' },
      order: { txiCreatedAt: 'ASC' },
      take: 100,
    });
    return entities.map((e) => this.toDomain(e));
  }

  async create(data: Partial<TaxInvoice>): Promise<TaxInvoice> {
    const created = this.repo.create({
      podId: data.orderId!,
      acdId: data.academyId!,
      txiInvoiceNo: data.invoiceNo!,
      txiSupplierBizNo: data.supplierBizNo!,
      txiBuyerBizNo: data.buyerBizNo ?? null,
      txiBuyerType: data.buyerType ?? 'PERSONAL',
      txiSupplyAmount: String(data.supplyAmount!),
      txiTaxAmount: String(data.taxAmount!),
      txiTotalAmount: String(data.totalAmount!),
      txiIssueDate: data.issueDate!,
      txiStatus: data.status ?? 'DRAFT',
    });
    const saved = await this.repo.save(created);
    return this.toDomain(saved);
  }

  async update(id: number, data: Partial<TaxInvoice>): Promise<TaxInvoice> {
    const updateData: Partial<PayTaxInvoiceEntity> = {};

    if (data.status !== undefined) updateData.txiStatus = data.status;
    if (data.ntsIssueNo !== undefined) updateData.txiNtsIssueNo = data.ntsIssueNo;
    if (data.ntsSubmittedAt !== undefined) updateData.txiNtsSubmittedAt = data.ntsSubmittedAt;
    if (data.ntsApprovedAt !== undefined) updateData.txiNtsApprovedAt = data.ntsApprovedAt;
    if (data.ntsErrorCode !== undefined) updateData.txiNtsErrorCode = data.ntsErrorCode;
    if (data.ntsErrorMessage !== undefined) updateData.txiNtsErrorMessage = data.ntsErrorMessage;
    if (data.xmlPayloadUrl !== undefined) updateData.txiXmlPayloadUrl = data.xmlPayloadUrl;
    if (data.pdfUrl !== undefined) updateData.txiPdfUrl = data.pdfUrl;

    if (Object.keys(updateData).length > 0) {
      await this.repo.update({ txiId: id }, updateData);
    }

    const entity = await this.repo.findOneOrFail({ where: { txiId: id } });
    return this.toDomain(entity);
  }

  private toDomain(entity: PayTaxInvoiceEntity): TaxInvoice {
    const inv = new TaxInvoice();
    inv.id = entity.txiId;
    inv.orderId = entity.podId;
    inv.academyId = entity.acdId;
    inv.invoiceNo = entity.txiInvoiceNo;
    inv.ntsIssueNo = entity.txiNtsIssueNo;
    inv.supplierBizNo = entity.txiSupplierBizNo;
    inv.buyerBizNo = entity.txiBuyerBizNo;
    inv.buyerType = entity.txiBuyerType;
    inv.supplyAmount = Number(entity.txiSupplyAmount);
    inv.taxAmount = Number(entity.txiTaxAmount);
    inv.totalAmount = Number(entity.txiTotalAmount);
    inv.issueDate = entity.txiIssueDate;
    inv.status = entity.txiStatus;
    inv.ntsSubmittedAt = entity.txiNtsSubmittedAt;
    inv.ntsApprovedAt = entity.txiNtsApprovedAt;
    inv.ntsErrorCode = entity.txiNtsErrorCode;
    inv.ntsErrorMessage = entity.txiNtsErrorMessage;
    inv.xmlPayloadUrl = entity.txiXmlPayloadUrl;
    inv.pdfUrl = entity.txiPdfUrl;
    inv.createdAt = entity.txiCreatedAt;
    inv.updatedAt = entity.txiUpdatedAt;

    // Joined fields
    inv.orderNo = entity.order?.podOrderNo ?? undefined;
    inv.studentName = entity.order?.enrollment?.student?.stdName ?? undefined;
    inv.programName = entity.order?.enrollment?.class?.program?.prgName ?? undefined;

    return inv;
  }
}
