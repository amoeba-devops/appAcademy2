import { AdsProviderClient } from './ads-provider.client';
import { AdsConnection, days, micros } from './ads.types';
import { applyAutomaticCost, AutomaticCost } from './ads-cost';
const connection = (provider: AdsConnection['provider']) =>
  ({
    provider,
    account_id: '123',
    config: { startDate: '2026-09-01', defaultSite: 'TPI', campaigns: {} },
  }) as AdsConnection;
describe('Advertising reports', () => {
  let client: AdsProviderClient;
  beforeEach(() => {
    client = new AdsProviderClient();
  });
  it('preserves micro precision and validates dates', () => {
    expect(micros('100000.000001')).toBe('100000000001');
    expect(() => micros('-1')).toThrow();
    expect(() => days('2026-02-30', '2026-03-01')).toThrow();
    expect(() => days('2026-09-01', '2026-10-05')).toThrow();
  });
  it('blocks arbitrary hosts', async () => {
    await expect(client.request('https://example.com')).rejects.toThrow(
      'INVALID_HOST',
    );
  });
  it('keeps GFA explicitly unavailable', async () => {
    await expect(
      client.report(connection('NAVER_GFA'), {}, '2026-09-01', '2026-09-01'),
    ).rejects.toThrow('GFA_PARTNER_ACCESS_REQUIRED');
  });
  it('consumes Meta pages using safe cursors', async () => {
    const request = jest
      .spyOn(client, 'request')
      .mockResolvedValueOnce({ currency: 'KRW', timezone_name: 'Asia/Seoul' })
      .mockResolvedValueOnce({
        data: [
          {
            campaign_id: '1',
            campaign_name: 'one',
            spend: '10.25',
            date_start: '2026-09-01',
            date_stop: '2026-09-01',
          },
        ],
        paging: { next: 'https://evil.test', cursors: { after: 'next' } },
      })
      .mockResolvedValueOnce({ data: [] });
    const r = await client.report(
      connection('META'),
      { accessToken: 'secret' },
      '2026-09-01',
      '2026-09-01',
    );
    expect(r.rows[0].micros).toBe('10250000');
    expect(request.mock.calls[2][0]).toContain('graph.facebook.com');
    expect(request.mock.calls[2][0]).toContain('after=next');
    expect(request.mock.calls[2][0]).not.toContain('secret');
  });
  it('rejects interrupted pagination', async () => {
    jest
      .spyOn(client, 'request')
      .mockResolvedValueOnce({ currency: 'KRW', timezone_name: 'Asia/Seoul' })
      .mockResolvedValueOnce({ data: [], paging: { next: 'exists' } });
    await expect(
      client.report(
        connection('META'),
        { accessToken: 's' },
        '2026-09-01',
        '2026-09-01',
      ),
    ).rejects.toThrow();
  });
  it('uses Naver ids and rejects missing stats', async () => {
    const request = jest
      .spyOn(client, 'request')
      .mockResolvedValueOnce([{ nccCampaignId: 'cmp-a', name: 'A' }])
      .mockResolvedValueOnce({ data: [] });
    await expect(
      client.report(
        connection('NAVER_SEARCH'),
        { apiKey: 'a', secretKey: 'b' },
        '2026-09-01',
        '2026-09-01',
      ),
    ).rejects.toThrow('INCOMPLETE_RESPONSE');
    expect(request.mock.calls[1][0]).toContain('ids=cmp-a');
  });
  it('holds legacy overlap and negative corrections', () => {
    const r = { amount: 30000, manualMode: null } as AutomaticCost;
    expect(applyAutomaticCost(100, [r])).toEqual({ cost: 100, pending: true });
    expect(applyAutomaticCost(100, [{ ...r, manualMode: 'ADD' }]).cost).toBe(
      30100,
    );
    expect(
      applyAutomaticCost(100, [{ ...r, manualMode: 'REPLACE' }]).cost,
    ).toBe(30000);
    expect(applyAutomaticCost(null, [{ ...r, amount: -1 }]).pending).toBe(true);
  });
});
