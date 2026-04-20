import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { ITaxInvoiceRepository } from '../../../domain/repositories/tax-invoice-repository.interface.js';
import { TAX_INVOICE_REPOSITORY } from '../../../domain/repositories/tax-invoice-repository.interface.js';

@Injectable()
export class TaxInvoiceBatchService {
  private readonly logger = new Logger(TaxInvoiceBatchService.name);

  constructor(
    @Inject(TAX_INVOICE_REPOSITORY)
    private readonly taxInvoiceRepo: ITaxInvoiceRepository,
  ) {}

  /**
   * Daily 09:00 — Check for DRAFT invoices approaching NTS deadline.
   * Legal requirement: submit by 10th of month following issuance.
   * Alert when 5 or fewer days remain (D-5).
   */
  @Cron('0 9 * * *')
  async checkPendingDeadlines(): Promise<void> {
    const pending = await this.taxInvoiceRepo.findPendingSubmission();
    if (pending.length === 0) return;

    const now = new Date();

    for (const invoice of pending) {
      // Deadline: 10th of next month from issue date
      const issueDate = new Date(invoice.issueDate);
      const deadlineMonth = issueDate.getMonth() + 1;
      const deadlineYear =
        deadlineMonth > 11
          ? issueDate.getFullYear() + 1
          : issueDate.getFullYear();
      const deadline = new Date(deadlineYear, deadlineMonth % 12, 10);

      const daysRemaining = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysRemaining <= 5) {
        this.logger.warn(
          `Tax invoice ${invoice.invoiceNo} deadline in ${daysRemaining} day(s) — issue date: ${invoice.issueDate}`,
        );
        // TODO: Send notification via AmoebaTalk or email
      }
    }
  }
}
