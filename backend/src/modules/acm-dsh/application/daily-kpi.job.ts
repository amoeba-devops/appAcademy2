import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DailyKpiService } from './daily-kpi.service';

@Injectable()
export class DailyKpiJob {
  private readonly logger = new Logger(DailyKpiJob.name);

  constructor(private readonly dailyKpi: DailyKpiService) {}

  /** FR-DSH-A01 — 03:00 KST nightly idempotent recompute. */
  @Cron('0 3 * * *', { timeZone: 'Asia/Seoul' })
  async runNightly(): Promise<void> {
    this.logger.log('Daily KPI batch starting');
    try {
      const result = await this.dailyKpi.runDailyBatch();
      this.logger.log(`Daily KPI batch done: ${result.entityCount} entities × ${result.dayCount} day-rows`);
    } catch (err) {
      this.logger.error('Daily KPI batch failed', err as Error);
    }
  }
}
