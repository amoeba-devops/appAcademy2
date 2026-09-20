import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BodaRecordingService } from './boda-recording.service';

/** 기본 따라잡기 범위(시간). env `BODA_RECORDING_SYNC_LOOKBACK_HOURS` 로 조정. */
const DEFAULT_LOOKBACK_HOURS = 48;

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
  /**
   * REQ-260920C C-2 — 실연동 전환 직후 과거 수업(보다 보관 1년)을 따라잡기 위해
   * 범위를 env 로 넓힐 수 있다(예: 720 = 30일). 평시에는 48h 로 되돌린다.
   */
  private readonly lookbackHours: number;

  constructor(
    private readonly svc: BodaRecordingService,
    config: ConfigService,
  ) {
    const n = Number(config.get('BODA_RECORDING_SYNC_LOOKBACK_HOURS'));
    this.lookbackHours =
      Number.isFinite(n) && n > 0 ? n : DEFAULT_LOOKBACK_HOURS;
  }

  @Cron('*/10 * * * *', { name: 'boda-recording-sweep' })
  async sweep(): Promise<void> {
    if (this.running) {
      this.logger.debug('previous sweep still running — skipped');
      return;
    }
    this.running = true;
    try {
      const targets = await this.svc.findEventsNeedingSync(this.lookbackHours);
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
