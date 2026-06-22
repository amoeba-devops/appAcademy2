import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import {
  PayLedgerEntryType,
  PayLedgerTypeormEntity,
} from '../../infrastructure/typeorm/pay-ledger.typeorm-entity';

/**
 * Append-only payment ledger — CHARGE / REFUND / ADJUSTMENT entries with
 * snapshotted refund tier on REFUND rows (A-013 audit).
 *
 * The ledger never edits a row — every state change creates a new entry.
 * Caller is responsible for computing the running balance; the service
 * looks it up from the last row to enforce monotonic balance accounting.
 */
@Injectable()
export class PayLedgerService {
  constructor(
    @InjectRepository(PayLedgerTypeormEntity, ACM_DS)
    private readonly repo: Repository<PayLedgerTypeormEntity>,
  ) {}

  async listForOrder(orderId: string): Promise<PayLedgerTypeormEntity[]> {
    return this.repo.find({
      where: { orderId },
      order: { recordedAt: 'ASC' },
    });
  }

  /** Last balance after the most-recent entry for this order (0 if none). */
  async currentBalance(orderId: string): Promise<number> {
    const last = await this.repo.findOne({
      where: { orderId },
      order: { recordedAt: 'DESC' },
    });
    return last?.balanceAfter ?? 0;
  }

  /**
   * Append a ledger entry. CHARGE is positive; REFUND is negative — the
   * caller passes the signed amount and the service computes
   * `balance_after = currentBalance + amount`.
   *
   * REFUND entries should pass the tier snapshot (refundTierId +
   * elapsedRatioAtRefund) so a future audit can re-derive why this
   * particular refund rate was applied.
   */
  async appendEntry(input: {
    orderId: string;
    entryType: PayLedgerEntryType;
    amount: number;
    refundTierId?: string | null;
    elapsedRatioAtRefund?: number | null;
    memo?: string | null;
    recordedBy?: string | null;
  }): Promise<PayLedgerTypeormEntity> {
    if (input.entryType === 'REFUND' && input.amount >= 0) {
      throw new BadRequestException({
        code: 'PAY_LEDGER_REFUND_AMOUNT_NOT_NEGATIVE',
        amount: input.amount,
      });
    }
    if (input.entryType === 'CHARGE' && input.amount <= 0) {
      throw new BadRequestException({
        code: 'PAY_LEDGER_CHARGE_AMOUNT_NOT_POSITIVE',
        amount: input.amount,
      });
    }
    const balance = await this.currentBalance(input.orderId);
    const row = this.repo.create({
      orderId: input.orderId,
      entryType: input.entryType,
      amount: input.amount,
      balanceAfter: balance + input.amount,
      refundTierId: input.refundTierId ?? null,
      elapsedRatioAtRefund: input.elapsedRatioAtRefund ?? null,
      memo: input.memo ?? null,
      recordedBy: input.recordedBy ?? null,
      recordedAt: new Date(),
    });
    return this.repo.save(row);
  }
}
