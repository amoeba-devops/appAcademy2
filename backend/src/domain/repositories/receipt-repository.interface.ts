import type { Receipt } from '../entities/receipt.js';

export interface IReceiptRepository {
  findByAcademyId(academyId: number): Promise<Receipt[]>;
  findById(id: number): Promise<Receipt | null>;
  findByOrderId(orderId: number): Promise<Receipt[]>;
}

export const RECEIPT_REPOSITORY = Symbol('IReceiptRepository');
