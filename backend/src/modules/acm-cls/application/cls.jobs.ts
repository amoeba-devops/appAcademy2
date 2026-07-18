import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { FeedbackService } from './feedback.service';
import { SessionService } from './session.service';
import { SettlementService } from './settlement.service';

@Injectable()
export class ClsJobs {
  private readonly logger = new Logger(ClsJobs.name);

  constructor(
    private readonly sessions: SessionService,
    private readonly feedback: FeedbackService,
    private readonly settlements: SettlementService,
  ) {}

  /** Generate sessions from recurrence — 02:00 KST nightly. */
  @Cron('0 2 * * *', { timeZone: 'Asia/Seoul' })
  async sessionGeneration(): Promise<void> {
    this.logger.log('Session generation batch starting');
    try {
      const result = await this.sessions.generateAll();
      this.logger.log(
        `Session generation done: ${result.classes} classes / ${result.generated} generated`,
      );
    } catch (err) {
      this.logger.error('Session generation failed', err as Error);
    }
  }

  /** Feedback SLA check — 09:00 KST daily (BR-CLS-008). */
  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async feedbackSlaCheck(): Promise<void> {
    this.logger.log('Feedback SLA check starting');
    try {
      const result = await this.feedback.checkSlaBreaches();
      this.logger.log(`Feedback SLA check done: ${result.flagged} flagged`);
    } catch (err) {
      this.logger.error('Feedback SLA check failed', err as Error);
    }
  }

  /** Settlement auto-confirm — 04:00 KST on 5th (BR-CLS-010). */
  @Cron('0 4 5 * *', { timeZone: 'Asia/Seoul' })
  async settlementAutoConfirm(): Promise<void> {
    this.logger.log('Settlement auto-confirm starting');
    try {
      const result = await this.settlements.autoConfirmPrevMonth();
      this.logger.log(
        `Settlement auto-confirm done: ${result.confirmed} confirmed`,
      );
    } catch (err) {
      this.logger.error('Settlement auto-confirm failed', err as Error);
    }
  }

  /**
   * CSL → CLS bridge — log a hint that a class should be created.
   * v1.0b: informational-only event listener; UI surfaces the prompt.
   */
  @OnEvent('acm.csl.class_started')
  onCslClassStarted(payload: { entId: string; inqId: string }): void {
    this.logger.log(
      `CSL.class_started ent=${payload.entId} inq=${payload.inqId} → CLS prompt`,
    );
  }
}
