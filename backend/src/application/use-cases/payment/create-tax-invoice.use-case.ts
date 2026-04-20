import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { IPaymentOrderRepository } from '../../../domain/repositories/payment-order-repository.interface.js';
import { PAYMENT_ORDER_REPOSITORY } from '../../../domain/repositories/payment-order-repository.interface.js';
import type { ITaxInvoiceRepository } from '../../../domain/repositories/tax-invoice-repository.interface.js';
import { TAX_INVOICE_REPOSITORY } from '../../../domain/repositories/tax-invoice-repository.interface.js';
import type { CreateTaxInvoiceDto } from '../../dto/payment/create-tax-invoice.dto.js';

@Injectable()
export class CreateTaxInvoiceUseCase {
  private readonly logger = new Logger(CreateTaxInvoiceUseCase.name);

  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly orderRepo: IPaymentOrderRepository,
    @Inject(TAX_INVOICE_REPOSITORY)
    private readonly taxInvoiceRepo: ITaxInvoiceRepository,
  ) {}

  async execute(academyId: number, dto: CreateTaxInvoiceDto) {
    const order = await this.orderRepo.findById(dto.orderId);
    if (!order) {
      throw new NotFoundException('Payment order not found');
    }
    if (order.status !== 'DONE' && order.status !== 'PARTIAL_CANCELED') {
      throw new UnprocessableEntityException(
        `Order status '${order.status}' is not eligible for tax invoice`,
      );
    }

    // Calculate supply amount and tax (10% VAT)
    const totalAmount = order.amount;
    const supplyAmount = Math.floor(totalAmount / 1.1);
    const taxAmount = totalAmount - supplyAmount;

    // Generate invoice number: TXI-{YYYYMMDD}-{random}
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const invoiceNo = `TXI-${dateStr}-${rand}`;

    const invoice = await this.taxInvoiceRepo.create({
      orderId: dto.orderId,
      academyId,
      invoiceNo,
      supplierBizNo: dto.supplierBizNo,
      buyerBizNo: dto.buyerBizNo ?? null,
      buyerType: dto.buyerType ?? 'PERSONAL',
      supplyAmount,
      taxAmount,
      totalAmount,
      issueDate: now.toISOString().slice(0, 10),
      status: 'DRAFT',
    });

    this.logger.log(`Tax invoice created: ${invoiceNo} for order ${order.id}`);
    return invoice;
  }
}
