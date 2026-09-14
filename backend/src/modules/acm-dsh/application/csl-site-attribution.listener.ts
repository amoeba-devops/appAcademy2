import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DailyKpiService } from './daily-kpi.service';

/**
 * 요구 260914G — 상담의 대시보드 사이트 귀속이 바뀌면 해당 날짜 KPI 를 즉시
 * 다시 계산한다.
 *
 * 사이트별 상담건수는 `COALESCE(inq_site_override, inq_source_site, 'COMMON')`
 * 로 집계되므로, 귀속만 바꾸고 야간 배치(03:00)를 기다리면 운영자는 방금 지정한
 * 건이 대시보드에 없는 상태를 보게 된다.
 *
 * 재계산 실패가 상담 수정 자체를 되돌려서는 안 되므로 여기서 삼킨다 —
 * 다음 야간 배치가 같은 날짜를 다시 계산해 스스로 수렴한다.
 */
@Injectable()
export class CslSiteAttributionListener {
  private readonly logger = new Logger(CslSiteAttributionListener.name);

  constructor(private readonly dailyKpi: DailyKpiService) {}

  @OnEvent('acm.csl.site_attribution.changed')
  async onSiteChanged(payload: {
    entId: string;
    date: string;
  }): Promise<void> {
    if (!payload?.entId || !payload?.date) return;
    try {
      await this.dailyKpi.recomputeDay(
        payload.entId,
        payload.date,
        'csl_site_attribution',
      );
    } catch (e) {
      this.logger.warn(
        `recompute after site attribution change failed ent=${payload.entId} date=${payload.date}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}
