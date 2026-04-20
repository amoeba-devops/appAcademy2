import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ITaxInvoiceRepository } from '../../../domain/repositories/tax-invoice-repository.interface.js';
import { TAX_INVOICE_REPOSITORY } from '../../../domain/repositories/tax-invoice-repository.interface.js';
import type { INtsEtaxProvider } from '../../../domain/repositories/nts-etax-provider.interface.js';
import { NTS_ETAX_PROVIDER } from '../../../domain/repositories/nts-etax-provider.interface.js';
import { TaxInvoiceStatus } from '../../../domain/entities/tax-invoice.js';

@Injectable()
export class SubmitTaxInvoiceUseCase {
  private readonly logger = new Logger(SubmitTaxInvoiceUseCase.name);

  constructor(
    @Inject(TAX_INVOICE_REPOSITORY)
    private readonly taxInvoiceRepo: ITaxInvoiceRepository,
    @Inject(NTS_ETAX_PROVIDER)
    private readonly ntsProvider: INtsEtaxProvider,
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
}
