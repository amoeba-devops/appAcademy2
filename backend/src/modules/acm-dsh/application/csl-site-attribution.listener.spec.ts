import { CslSiteAttributionListener } from './csl-site-attribution.listener';
import type { DailyKpiService } from './daily-kpi.service';

/**
 * 요구 260914G — 상담의 사이트 귀속이 바뀌면 그 날짜 KPI 를 즉시 재계산한다.
 * 재계산 실패가 상담 수정을 되돌려서는 안 된다.
 */
describe('CslSiteAttributionListener', () => {
  let recomputeDay: jest.Mock;
  let listener: CslSiteAttributionListener;

  beforeEach(() => {
    recomputeDay = jest.fn().mockResolvedValue(undefined);
    listener = new CslSiteAttributionListener({
      recomputeDay,
    } as unknown as DailyKpiService);
  });

  it('recomputes the inquiry date on attribution change', async () => {
    await listener.onSiteChanged({ entId: 'ent-1', date: '2026-09-14' });
    expect(recomputeDay).toHaveBeenCalledWith(
      'ent-1',
      '2026-09-14',
      'csl_site_attribution',
    );
  });

  it('ignores malformed payloads', async () => {
    await listener.onSiteChanged({ entId: '', date: '' });
    expect(recomputeDay).not.toHaveBeenCalled();
  });

  it('swallows recompute failures — the nightly batch converges anyway', async () => {
    recomputeDay.mockRejectedValue(new Error('db down'));
    await expect(
      listener.onSiteChanged({ entId: 'ent-1', date: '2026-09-14' }),
    ).resolves.toBeUndefined();
  });
});
