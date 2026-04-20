import {
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { ProcessWebhookUseCase } from '../../application/use-cases/payment/process-webhook.use-case.js';
import type { TossWebhookPayload } from '../../application/use-cases/payment/process-webhook.use-case.js';
import { TossWebhookGuard } from '../guards/toss-webhook.guard';

@ApiExcludeController()
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly processWebhook: ProcessWebhookUseCase,
  ) {}

  @Post('toss')
  @HttpCode(200)
  @UseGuards(TossWebhookGuard)
  async handleTossWebhook(@Req() req: Request) {
    const body = req.body as TossWebhookPayload;
    this.logger.log(
      `Toss webhook received: eventType=${body.eventType}, paymentKey=${body.data?.paymentKey}`,
    );
    await this.processWebhook.execute(body);
    return { success: true };
  }
}
