import type { TaxInvoice } from '../entities/tax-invoice.js';

export interface ITaxInvoiceRepository {
  findById(id: number): Promise<TaxInvoice | null>;
  findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; dateFrom?: string; dateTo?: string },
  ): Promise<TaxInvoice[]>;
  findByOrderId(orderId: number): Promise<TaxInvoice[]>;
  findPendingSubmission(): Promise<TaxInvoice[]>;
  create(entity: Partial<TaxInvoice>): Promise<TaxInvoice>;
  update(id: number, entity: Partial<TaxInvoice>): Promise<TaxInvoice>;
}

export const TAX_INVOICE_REPOSITORY = Symbol('ITaxInvoiceRepository');
