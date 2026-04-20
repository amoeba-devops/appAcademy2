import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayLedgerEntity } from '../entities/pay-ledger.entity';
import { LedgerEntry } from '../../../domain/entities/ledger-entry.js';
import type { ILedgerRepository } from '../../../domain/repositories/ledger-repository.interface.js';

@Injectable()
export class LedgerRepository implements ILedgerRepository {
  constructor(
    @InjectRepository(PayLedgerEntity)
    private readonly repo: Repository<PayLedgerEntity>,
  ) {}

  async create(entry: Partial<LedgerEntry>): Promise<LedgerEntry> {
    const created = this.repo.create({
      podId: entry.orderId!,
      ldgEntryType: entry.entryType!,
      ldgAmount: String(entry.amount!),
      ldgBalanceAfter: String(entry.balanceAfter!),
      rptId: entry.refundTierId ?? null,
      ldgElapsedRatioAtRefund: entry.elapsedRatioAtRefund != null
        ? String(entry.elapsedRatioAtRefund)
        : null,
      ldgMemo: entry.memo ?? null,
      ldgRecordedBy: entry.recordedBy ?? null,
    });
    const saved = await this.repo.save(created);
    return this.toDomain(saved);
  }

  async findByOrderId(orderId: number): Promise<LedgerEntry[]> {
    const entities = await this.repo.find({
      where: { podId: orderId },
      order: { ldgRecordedAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  private toDomain(entity: PayLedgerEntity): LedgerEntry {
    const entry = new LedgerEntry();
    entry.id = entity.ldgId;
    entry.orderId = entity.podId;
    entry.entryType = entity.ldgEntryType;
    entry.amount = Number(entity.ldgAmount);
    entry.balanceAfter = Number(entity.ldgBalanceAfter);
    entry.refundTierId = entity.rptId;
    entry.elapsedRatioAtRefund = entity.ldgElapsedRatioAtRefund != null
      ? Number(entity.ldgElapsedRatioAtRefund)
      : null;
    entry.memo = entity.ldgMemo;
    entry.recordedBy = entity.ldgRecordedBy;
    entry.recordedAt = entity.ldgRecordedAt;
    return entry;
  }
}
