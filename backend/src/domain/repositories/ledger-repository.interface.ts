import type { LedgerEntry } from '../entities/ledger-entry.js';

export interface ILedgerRepository {
  create(entry: Partial<LedgerEntry>): Promise<LedgerEntry>;
  findByOrderId(orderId: number): Promise<LedgerEntry[]>;
}

export const LEDGER_REPOSITORY = Symbol('ILedgerRepository');
