import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IPaymentProvider,
  TossCancelRequest,
  TossCancelResponse,
  TossConfirmRequest,
  TossConfirmResponse,
  TossFetchResponse,
} from '../../../domain/repositories/payment-provider.interface.js';

@Injectable()
export class TossPaymentsClient implements IPaymentProvider {
  private readonly logger = new Logger(TossPaymentsClient.name);
  private readonly baseUrl: string;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'TOSS_API_URL',
      'https://api.tosspayments.com/v1',
    );
    this.secretKey = this.configService.get<string>('TOSS_SECRET_KEY', '');
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`;
  }

  async confirm(req: TossConfirmRequest): Promise<TossConfirmResponse> {
    this.logger.log(`Confirming payment: orderId=${req.orderId}`);

    const response = await fetch(`${this.baseUrl}/payments/confirm`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        'Idempotency-Key': req.orderId,
      },
      body: JSON.stringify({
        paymentKey: req.paymentKey,
        orderId: req.orderId,
        amount: req.amount,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      this.logger.error(`Toss confirm failed: ${JSON.stringify(error)}`);
      throw new Error(`Toss confirm failed: ${error.code} - ${error.message}`);
    }

    const data = await response.json();
    return {
      paymentKey: data.paymentKey,
      orderId: data.orderId,
      status: data.status,
      method: data.method,
      totalAmount: data.totalAmount,
      approvedAt: data.approvedAt,
      receipt: data.receipt,
    };
  }

  async cancel(req: TossCancelRequest): Promise<TossCancelResponse> {
    this.logger.log(`Canceling payment: paymentKey=${req.paymentKey}`);

    const response = await fetch(
      `${this.baseUrl}/payments/${req.paymentKey}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelReason: req.cancelReason,
          ...(req.cancelAmount != null && { cancelAmount: req.cancelAmount }),
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      this.logger.error(`Toss cancel failed: ${JSON.stringify(error)}`);
      throw new Error(`Toss cancel failed: ${error.code} - ${error.message}`);
    }

    const data = await response.json();
    return {
      paymentKey: data.paymentKey,
      orderId: data.orderId,
      status: data.status,
      cancels: data.cancels ?? [],
    };
  }

  async fetchPayment(paymentKey: string): Promise<TossFetchResponse> {
    this.logger.log(`Fetching payment: paymentKey=${paymentKey}`);

    const response = await fetch(
      `${this.baseUrl}/payments/${paymentKey}`,
      {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
        },
      },
    );

    if (!response.ok) {
      const error = await response.json();
      this.logger.error(`Toss fetch failed: ${JSON.stringify(error)}`);
      throw new Error(`Toss fetch failed: ${error.code} - ${error.message}`);
    }

    const data = await response.json();
    return {
      paymentKey: data.paymentKey,
      orderId: data.orderId,
      status: data.status,
      method: data.method,
      totalAmount: data.totalAmount,
      approvedAt: data.approvedAt ?? null,
      cancels: data.cancels,
    };
  }
}
