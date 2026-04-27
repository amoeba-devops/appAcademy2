import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type { Request } from 'express';
import { verifyAmaWebhook } from '../../infrastructure/external/ama/webhook/ama-webhook-signature.util';
import { SubscriptionEventEntity } from '../../infrastructure/database/entities/subscription-event.entity';
import {
  ProvisioningUseCase,
  ProvisionInput,
} from '../../application/subscription/provisioning.use-case';
import {
  LifecycleAction,
  LifecycleUseCase,
} from '../../application/subscription/lifecycle.use-case';

interface WebhookPayload {
  eventType?: string;
  tenantId?: string;
  plan?: string | null;
  name?: string | null;
  slug?: string | null;
  isDemo?: boolean;
  occurredAt?: string;
}

const EVENT_TO_ACTION: Record<string, LifecycleAction | 'PROVISION'> = {
  SUBSCRIPTION_CREATED: 'PROVISION',
  SUBSCRIPTION_ACTIVATED: 'PROVISION',
  SUBSCRIPTION_RESUMED: 'RESUME',
  SUBSCRIPTION_SUSPENDED: 'SUSPEND',
  SUBSCRIPTION_CANCELED: 'CANCEL',
  SUBSCRIPTION_DEPROVISIONED: 'DEPROVISION',
  SUBSCRIPTION_PLAN_CHANGED: 'PLAN_CHANGED',
};

@ApiTags('webhooks')
@Controller('webhooks/ama')
export class AmaSubscriptionWebhookController {
  private readonly logger = new Logger(AmaSubscriptionWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SubscriptionEventEntity)
    private readonly eventRepo: Repository<SubscriptionEventEntity>,
    private readonly provisioning: ProvisioningUseCase,
    private readonly lifecycle: LifecycleUseCase,
  ) {}

  @Post('subscription')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async receive(
    @Req() req: Request,
    @Body() body: WebhookPayload,
    @Headers('x-ama-signature') signature?: string,
    @Headers('x-ama-timestamp') timestamp?: string,
    @Headers('x-ama-nonce') nonce?: string,
  ): Promise<{ ok: true; acdId: number | null; deduped?: boolean }> {
    const secret = this.config.get<string>('AMA_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.error('AMA_WEBHOOK_SECRET not configured');
      throw new UnauthorizedException('WEBHOOK_NOT_CONFIGURED');
    }

    const rawBody =
      (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ??
      JSON.stringify(body ?? {});

    const verified = verifyAmaWebhook({
      secret,
      rawBody,
      headers: { signature, timestamp, nonce },
    });
    if (!verified.ok) {
      this.logger.warn(`Webhook rejected: ${verified.reason}`);
      throw new UnauthorizedException(`WEBHOOK_${verified.reason}`);
    }

    const eventType = body?.eventType;
    const tenantId = body?.tenantId;
    if (!eventType || !tenantId) {
      throw new BadRequestException('MISSING_EVENT_OR_TENANT');
    }
    const route = EVENT_TO_ACTION[eventType];
    if (!route) {
      throw new BadRequestException(`UNKNOWN_EVENT_TYPE:${eventType}`);
    }

    // Pre-check nonce dedup (cheap optimistic) — DB unique still authoritative.
    const existing = await this.eventRepo.findOne({
      where: { subNonce: verified.nonce },
    });
    if (existing) {
      return { ok: true, acdId: existing.acdId, deduped: true };
    }

    const eventAt = body.occurredAt ? new Date(body.occurredAt) : new Date(verified.timestamp * 1000);

    try {
      if (route === 'PROVISION') {
        const provisionInput: ProvisionInput = {
          amaTenantId: tenantId,
          plan: body.plan ?? null,
          name: body.name ?? null,
          slug: body.slug ?? null,
          isDemo: !!body.isDemo,
          eventNonce: verified.nonce,
          eventAt,
          signature: signature ?? '',
          rawPayload: body as unknown as Record<string, unknown>,
        };
        const result = await this.provisioning.provision(provisionInput);
        return { ok: true, acdId: result.acdId };
      }
      const result = await this.lifecycle.apply({
        amaTenantId: tenantId,
        action: route,
        plan: body.plan ?? null,
        eventNonce: verified.nonce,
        eventAt,
        signature: signature ?? '',
        rawPayload: body as unknown as Record<string, unknown>,
      });
      return { ok: true, acdId: result.acdId };
    } catch (err) {
      if (err instanceof QueryFailedError && /Duplicate/i.test(err.message)) {
        // Race on nonce uniqueness — treat as deduped success.
        const ev = await this.eventRepo.findOne({
          where: { subNonce: verified.nonce },
        });
        return { ok: true, acdId: ev?.acdId ?? null, deduped: true };
      }
      if (err instanceof ConflictException) throw err;
      throw err;
    }
  }
}
