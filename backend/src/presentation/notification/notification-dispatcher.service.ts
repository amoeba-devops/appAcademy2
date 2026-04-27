import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplateEntity } from '../../infrastructure/database/entities/notification-template.entity';
import { NotificationLogEntity } from '../../infrastructure/database/entities/notification-log.entity';
import { AMOEBATALK_CLIENT } from '../../infrastructure/external/ama/notify/interfaces/amoebatalk-client.interface';
import type { IAmoebaTalkClient } from '../../infrastructure/external/ama/notify/interfaces/amoebatalk-client.interface';
import { renderTemplate } from '../../application/notification/render-template.util';
import {
  EVENT_TO_NTF_EVENT,
  NOTIFICATION_EVENTS,
  type NotificationContext,
  type NotificationEventName,
} from '../../application/notification/notification-context.types';

/**
 * Listens for `tac.*` domain events and dispatches AmoebaTalk notifications.
 *
 * Behavior:
 *  - Looks up template by (acd_id, ntf_event)
 *  - Renders body via {@link renderTemplate}
 *  - Calls AmoebaTalkClient.send for each recipient (best-effort, isolated try)
 *  - Persists `tac_notification_logs` row per recipient with SENT or FAILED
 *
 * C-NTF-01: Failures NEVER bubble to the domain transaction. All errors are caught
 * and logged. Domain code only emits, never awaits delivery.
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    @InjectRepository(NotificationTemplateEntity)
    private readonly tplRepo: Repository<NotificationTemplateEntity>,
    @InjectRepository(NotificationLogEntity)
    private readonly logRepo: Repository<NotificationLogEntity>,
    @Inject(AMOEBATALK_CLIENT)
    private readonly client: IAmoebaTalkClient,
  ) {}

  // Wildcard handler — listens to all 7 events declared in NOTIFICATION_EVENTS.
  // (We bind individually so each is recorded in the EventEmitter introspection.)
  @OnEvent(NOTIFICATION_EVENTS.ConsultationReceived, { async: true })
  onConsultation(ctx: NotificationContext): Promise<void> {
    return this.dispatch(NOTIFICATION_EVENTS.ConsultationReceived, ctx);
  }

  @OnEvent(NOTIFICATION_EVENTS.EnrollmentConfirmed, { async: true })
  onEnrollment(ctx: NotificationContext): Promise<void> {
    return this.dispatch(NOTIFICATION_EVENTS.EnrollmentConfirmed, ctx);
  }

  @OnEvent(NOTIFICATION_EVENTS.PaymentDone, { async: true })
  onPayment(ctx: NotificationContext): Promise<void> {
    return this.dispatch(NOTIFICATION_EVENTS.PaymentDone, ctx);
  }

  @OnEvent(NOTIFICATION_EVENTS.RefundDone, { async: true })
  onRefund(ctx: NotificationContext): Promise<void> {
    return this.dispatch(NOTIFICATION_EVENTS.RefundDone, ctx);
  }

  @OnEvent(NOTIFICATION_EVENTS.MapScorePublished, { async: true })
  onMap(ctx: NotificationContext): Promise<void> {
    return this.dispatch(NOTIFICATION_EVENTS.MapScorePublished, ctx);
  }

  @OnEvent(NOTIFICATION_EVENTS.ClassAbsent, { async: true })
  onAbsent(ctx: NotificationContext): Promise<void> {
    return this.dispatch(NOTIFICATION_EVENTS.ClassAbsent, ctx);
  }

  @OnEvent(NOTIFICATION_EVENTS.TaxInvoiceApproved, { async: true })
  onTaxInvoice(ctx: NotificationContext): Promise<void> {
    return this.dispatch(NOTIFICATION_EVENTS.TaxInvoiceApproved, ctx);
  }

  /**
   * Public API — used by `resend` and `test-send` controllers.
   * Stops after dispatching all recipients; never throws (best-effort).
   */
  async dispatch(
    eventName: NotificationEventName,
    ctx: NotificationContext,
  ): Promise<void> {
    try {
      const ntfEvent = EVENT_TO_NTF_EVENT[eventName];
      const template = await this.tplRepo.findOne({
        where: { acdId: ctx.academyId, ntfEvent, ntfIsActive: 1 },
      });
      if (!template) {
        this.logger.warn(
          `Template not found for event=${ntfEvent} academy=${ctx.academyId}`,
        );
        for (const recipient of ctx.recipients) {
          await this.persistLog({
            ctx,
            ntfEvent,
            templateId: null,
            body: '',
            status: 'FAILED',
            errorCode: 'TEMPLATE_NOT_FOUND',
            errorMessage: `No active template for ${ntfEvent}`,
            recipient,
          });
        }
        return;
      }

      const variables = stringifyVars(ctx.variables);
      const { body, missing } = renderTemplate(template.ntfBody, variables);
      if (missing.length > 0) {
        this.logger.warn(
          `Missing variables for ${ntfEvent}: ${missing.join(', ')}`,
        );
      }

      for (const recipient of ctx.recipients) {
        await this.deliver({
          ctx,
          ntfEvent,
          template,
          body,
          recipient,
          variables,
        });
      }
    } catch (err) {
      // Last-line defense — never bubble out
      this.logger.error(
        `Dispatcher fatal error for ${eventName}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async deliver(args: {
    ctx: NotificationContext;
    ntfEvent: string;
    template: NotificationTemplateEntity;
    body: string;
    recipient: string;
    variables: Record<string, string>;
  }): Promise<void> {
    const { ctx, ntfEvent, template, body, recipient, variables } = args;
    try {
      const result = await this.client.send({
        to: recipient,
        templateCode: ntfEvent, // B-03: 1:1 mapping
        variables,
        body,
      });
      await this.persistLog({
        ctx,
        ntfEvent,
        templateId: template.ntfId,
        body,
        status: 'SENT',
        providerMsgId: result.messageId,
        recipient,
        variables,
      });
    } catch (err) {
      this.logger.error(
        `Send failed event=${ntfEvent} recipient=${maskPhone(recipient)}: ${(err as Error).message}`,
      );
      await this.persistLog({
        ctx,
        ntfEvent,
        templateId: template.ntfId,
        body,
        status: 'FAILED',
        errorCode:
          (err as { response?: { error?: { code?: string } } })?.response?.error?.code ??
          'SEND_ERROR',
        errorMessage: (err as Error).message?.slice(0, 500),
        recipient,
        variables,
      });
    }
  }

  private async persistLog(args: {
    ctx: NotificationContext;
    ntfEvent: string;
    templateId: number | null;
    body: string;
    status: 'SENT' | 'FAILED';
    providerMsgId?: string;
    errorCode?: string;
    errorMessage?: string;
    recipient: string;
    variables?: Record<string, string>;
  }): Promise<void> {
    const log = this.logRepo.create({
      acdId: args.ctx.academyId,
      nlgEvent: args.ntfEvent,
      nlgTemplateId: args.templateId,
      nlgChannel: 'TALK',
      nlgRecipient: args.recipient,
      nlgRecipientKind: args.ctx.recipientKind ?? 'PARENT',
      nlgSubjectId: args.ctx.subjectId ?? null,
      nlgSubjectKind: args.ctx.subjectKind ?? null,
      nlgBody: args.body,
      nlgVariables: (args.variables ?? args.ctx.variables) as Record<string, unknown>,
      nlgStatus: args.status,
      nlgProviderMsgId: args.providerMsgId ?? null,
      nlgErrorCode: args.errorCode ?? null,
      nlgErrorMessage: args.errorMessage ?? null,
      nlgAttempts: 1,
      nlgSentAt: args.status === 'SENT' ? new Date() : null,
    });
    await this.logRepo.save(log);
  }
}

function stringifyVars(v: Record<string, string | number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(v ?? {})) out[k] = String(v[k]);
  return out;
}

function maskPhone(p: string): string {
  if (!p) return '';
  const digits = p.replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(digits.length);
  const last = digits.slice(-4);
  return p.replace(/\d(?=\d{4})/g, '*').replace(/\d{4}$/, last);
}
