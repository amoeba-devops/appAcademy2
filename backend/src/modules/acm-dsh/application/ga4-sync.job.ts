import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Ga4SyncService } from './ga4-sync.service';

/** PLN-260912 — 04:00 KST nightly GA4 visitor sync (after the 03:00 KPI batch). */
@Injectable()
export class Ga4SyncJob {
  private readonly logger = new Logger(Ga4SyncJob.name);

  constructor(private readonly sync: Ga4SyncService) {}

  @Cron('0 4 * * *', { timeZone: 'Asia/Seoul' })
  async runNightly(): Promise<void> {
    this.logger.log('GA4 visitor sync starting');
    try {
      const r = await this.sync.runNightly();
      this.logger.log(
        `GA4 visitor sync done: ${r.tenants} tenants, ${r.failed} failed`,
      );
    } catch (err) {
      this.logger.error('GA4 visitor sync failed', err as Error);
    }
  }
}
