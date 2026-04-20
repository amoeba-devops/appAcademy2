import { Inject, Injectable } from '@nestjs/common';
import type { ITaxInvoiceRepository } from '../../../domain/repositories/tax-invoice-repository.interface.js';
import { TAX_INVOICE_REPOSITORY } from '../../../domain/repositories/tax-invoice-repository.interface.js';

@Injectable()
export class GetTaxInvoicesUseCase {
  constructor(
    @Inject(TAX_INVOICE_REPOSITORY)
    private readonly taxInvoiceRepo: ITaxInvoiceRepository,
  ) {}

  async execute(
    academyId: number,
    filters: { status?: string; dateFrom?: string; dateTo?: string },
  ) {
    return this.taxInvoiceRepo.findByAcademyIdWithFilters(academyId, filters);
  }

  async executeById(id: number) {
    return this.taxInvoiceRepo.findById(id);
  }
}
