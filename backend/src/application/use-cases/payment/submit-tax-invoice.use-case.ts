import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ITaxInvoiceRepository } from '../../../domain/repositories/tax-invoice-repository.interface.js';
import { TAX_INVOICE_REPOSITORY } from '../../../domain/repositories/tax-invoice-repository.interface.js';
import type { INtsEtaxProvider } from '../../../domain/repositories/nts-etax-provider.interface.js';
import { NTS_ETAX_PROVIDER } from '../../../domain/repositories/nts-etax-provider.interface.js';
import type { IPaymentOrderRepository } from '../../../domain/repositories/payment-order-repository.interface.js';
import { PAYMENT_ORDER_REPOSITORY } from '../../../domain/repositories/payment-order-repository.interface.js';
import type { IEnrollmentRepository } from '../../../domain/repositories/enrollment-repository.interface.js';
import { ENROLLMENT_REPOSITORY } from '../../../domain/repositories/enrollment-repository.interface.js';
import type { IStudentRepository } from '../../../domain/repositories/student-repository.interface.js';
import { STUDENT_REPOSITORY } from '../../../domain/repositories/student-repository.interface.js';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface.js';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface.js';
import { TaxInvoiceStatus } from '../../../domain/entities/tax-invoice.js';
import { NOTIFICATION_EVENTS } from '../../notification/notification-context.types.js';

@Injectable()
export class SubmitTaxInvoiceUseCase {
  private readonly logger = new Logger(SubmitTaxInvoiceUseCase.name);

  constructor(
    @Inject(TAX_INVOICE_REPOSITORY)
    private readonly taxInvoiceRepo: ITaxInvoiceRepository,
    @Inject(NTS_ETAX_PROVIDER)
    private readonly ntsProvider: INtsEtaxProvider,
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly orderRepo: IPaymentOrderRepository,
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepo: IEnrollmentRepository,
    @Inject(STUDENT_REPOSITORY)
    private readonly studentRepo: IStudentRepository,
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(invoiceId: number) {
    const invoice = await this.taxInvoiceRepo.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundException('Tax invoice not found');
    }
    if (invoice.status !== TaxInvoiceStatus.DRAFT) {
      throw new UnprocessableEntityException(
        `Invoice status '${invoice.status}' cannot be submitted`,
      );
    }

    // Update status to SUBMITTED
    await this.taxInvoiceRepo.update(invoice.id, {
      status: TaxInvoiceStatus.SUBMITTED,
      ntsSubmittedAt: new Date(),
    });

    // Call NTS eTax API
    const result = await this.ntsProvider.submit({
      invoiceNo: invoice.invoiceNo,
      supplierBizNo: invoice.supplierBizNo,
      buyerBizNo: invoice.buyerBizNo,
      buyerType: invoice.buyerType,
      supplyAmount: invoice.supplyAmount,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      issueDate: invoice.issueDate,
    });

    if (result.success) {
      const updated = await this.taxInvoiceRepo.update(invoice.id, {
        status: TaxInvoiceStatus.APPROVED,
        ntsIssueNo: result.ntsIssueNo,
        ntsApprovedAt: result.approvedAt ? new Date(result.approvedAt) : new Date(),
        ntsErrorCode: null,
        ntsErrorMessage: null,
      });

      this.logger.log(
        `Tax invoice approved: ${invoice.invoiceNo}, ntsIssueNo=${result.ntsIssueNo}`,
      );

      // C-NTF-01: best-effort notification
      try {
        const phone = await this.resolveParentPhone(invoice.orderId);
        if (phone) {
          this.events.emit(NOTIFICATION_EVENTS.TaxInvoiceApproved, {
            academyId: invoice.academyId,
            recipients: [phone],
            recipientKind: 'PARENT',
            subjectId: updated.id,
            subjectKind: 'TAX_INVOICE',
            variables: {
              invoiceNo: invoice.invoiceNo ?? '',
              ntsIssueNo: result.ntsIssueNo ?? '',
              totalAmount: String(invoice.totalAmount ?? 0),
            },
          });
        }
      } catch (err) {
        this.logger.warn(
          `Failed to emit TAX_INVOICE_APPROVED event: ${(err as Error).message}`,
        );
      }

      return updated;
    } else {
      const updated = await this.taxInvoiceRepo.update(invoice.id, {
        status: TaxInvoiceStatus.REJECTED,
        ntsErrorCode: result.errorCode,
        ntsErrorMessage: result.errorMessage,
      });

      this.logger.warn(
        `Tax invoice rejected: ${invoice.invoiceNo}, error=${result.errorCode}`,
      );
      return updated;
    }
  }

  private async resolveParentPhone(orderId: number): Promise<string | null> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) return null;
    const enr = await this.enrollmentRepo.findById(order.enrollmentId);
    if (!enr) return null;
    const parentId = enr.appliedParentId ?? null;
    if (!parentId) {
      const student = await this.studentRepo.findById(enr.studentId);
      const pid = student?.primaryParentId;
      if (!pid) return null;
      const p = await this.parentRepo.findById(pid);
      return p?.phone ?? null;
    }
    const parent = await this.parentRepo.findById(parentId);
    return parent?.phone ?? null;
  }
}
