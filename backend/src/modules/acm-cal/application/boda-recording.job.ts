import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BodaRecordingService } from './boda-recording.service';

/**
 * REQ-260912B — 녹화본 따라잡기 + ACM 보관 워커.
 *
 *  • 10 분마다: 최근 48h 내 종료된 보다 수업 중 녹화 레코드가 없는 건을
 *    SERVER API 목록으로 동기화 (웹훅 event 21 유실 대비).
 *  • 이어서 보관 대기(PENDING/FAILED) 건을 소량씩 ACM S3 로 복사.
 *
 * 영상은 용량이 크므로 한 틱에 소수만 처리한다 (기본 3건).
 */
@Injectable()
export class BodaRecordingJob {
  private readonly logger = new Logger(BodaRecordingJob.name);
  private running = false;

  constructor(private readonly svc: BodaRecordingService) {}

  @Cron('*/10 * * * *', { name: 'boda-recording-sweep' })
  async sweep(): Promise<void> {
    if (this.running) {
      this.logger.debug('previous sweep still running — skipped');
      return;
    }
    this.running = true;
    try {
      const targets = await this.svc.findEventsNeedingSync();
      let synced = 0;
      for (const t of targets) {
        try {
          await this.svc.syncEvent(t.entId, t.evtId);
          synced++;
        } catch (e) {
          this.logger.warn(
            `recording sync failed evtId=${t.evtId}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }

      const r = await this.svc.archiveDue();
      if (synced || r.picked) {
        this.logger.log(
          `recording sweep: synced=${synced}/${targets.length} archived=${r.archived} failed=${r.failed}`,
        );
      }
    } catch (e) {
      this.logger.error(
        `recording sweep failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
