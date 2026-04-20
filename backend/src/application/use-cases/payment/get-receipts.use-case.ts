import { Inject, Injectable } from '@nestjs/common';
import type { IReceiptRepository } from '../../../domain/repositories/receipt-repository.interface.js';
import { RECEIPT_REPOSITORY } from '../../../domain/repositories/receipt-repository.interface.js';

@Injectable()
export class GetReceiptsUseCase {
  constructor(
    @Inject(RECEIPT_REPOSITORY)
    private readonly receiptRepo: IReceiptRepository,
  ) {}

  async execute(academyId: number) {
    return this.receiptRepo.findByAcademyId(academyId);
  }

  async executeById(id: number) {
    return this.receiptRepo.findById(id);
  }
}
