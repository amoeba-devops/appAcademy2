import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

@Injectable()
export class TossWebhookGuard implements CanActivate {
  private readonly logger = new Logger(TossWebhookGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();

    const signature = req.headers['tosspayments-signature'] as
      | string
      | undefined;

    if (!signature) {
      this.logger.warn('Missing TossPayments-Signature header');
      throw new UnauthorizedException('Missing webhook signature');
    }

    const webhookSecret = this.configService.get<string>(
      'TOSS_WEBHOOK_SECRET',
      '',
    );
    if (!webhookSecret) {
      this.logger.error('TOSS_WEBHOOK_SECRET not configured');
      throw new UnauthorizedException('Webhook secret not configured');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.error('Raw body not available — ensure rawBody:true in NestFactory');
      throw new UnauthorizedException('Cannot verify signature');
    }

    const expected = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('base64');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expected);
    if (
      sigBuffer.length !== expBuffer.length ||
      !timingSafeEqual(sigBuffer, expBuffer)
    ) {
      this.logger.warn('Invalid webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
