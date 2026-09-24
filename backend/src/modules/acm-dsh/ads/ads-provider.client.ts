import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import {
  AdsConnection,
  AdsError,
  Credentials,
  Report,
  Spend,
  days,
  micros,
} from './ads.types';
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new AdsError('INVALID_RESPONSE');
  return v as Record<string, unknown>;
};
const array = (v: unknown): unknown[] => {
  if (!Array.isArray(v)) throw new AdsError('INCOMPLETE_RESPONSE');
  return v;
};
const str = (v: unknown) => {
  if (typeof v !== 'string' && typeof v !== 'number')
    throw new AdsError('INVALID_RESPONSE');
  return String(v);
};
@Injectable()
export class AdsProviderClient {
  async request(url: string, init: RequestInit = {}): Promise<unknown> {
    const allowed = [
      'graph.facebook.com',
      'googleads.googleapis.com',
      'oauth2.googleapis.com',
      'api.searchad.naver.com',
    ];
    const u = new URL(url);
    if (
      u.protocol !== 'https:' ||
      !allowed.includes(u.hostname) ||
      u.username ||
      u.password
    )
      throw new AdsError('INVALID_HOST');
    for (let attempt = 0; attempt < 3; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          ...init,
          redirect: 'error',
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        if (attempt === 2) throw new AdsError('NETWORK_ERROR');
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt === 2)
          throw new AdsError(
            res.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_UNAVAILABLE',
          );
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (!res.ok)
        throw new AdsError(
          res.status === 401
            ? 'AUTH_REQUIRED'
            : res.status === 403
              ? 'ACCESS_DENIED'
              : 'PROVIDER_REQUEST_FAILED',
        );
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new AdsError('INVALID_RESPONSE');
      }
      if (data && typeof data === 'object' && 'error' in data)
        throw new AdsError('PROVIDER_REQUEST_FAILED');
      return data;
    }
    throw new AdsError('PROVIDER_UNAVAILABLE');
  }
  async report(
    c: AdsConnection,
    k: Credentials,
    from: string,
    to: string,
  ): Promise<Report> {
    days(from, to);
    if (c.provider === 'NAVER_GFA')
      throw new AdsError('GFA_PARTNER_ACCESS_REQUIRED');
    if (c.provider === 'META') return this.meta(c, k, from, to);
    if (c.provider === 'GOOGLE') return this.google(c, k, from, to);
    return this.naver(c, k, from, to);
  }
  private async meta(
    c: AdsConnection,
    k: Credentials,
    from: string,
    to: string,
  ): Promise<Report> {
    if (!k.accessToken) throw new AdsError('CREDENTIALS_REQUIRED');
    const base = `https://graph.facebook.com/${c.config.apiVersion || 'v26.0'}/act_${c.account_id.replace(/^act_/, '')}`;
    const headers = { Authorization: `Bearer ${k.accessToken}` };
    const account = object(
      await this.request(`${base}?fields=currency,timezone_name`, { headers }),
    );
    const params = new URLSearchParams({
      fields: 'campaign_id,campaign_name,spend,date_start,date_stop',
      level: 'campaign',
      time_increment: '1',
      time_range: JSON.stringify({ since: from, until: to }),
      limit: '500',
    });
    const rows: Spend[] = [];
    let after = '';
    const seen = new Set<string>();
    for (let page = 0; page < 200; page++) {
      if (after) params.set('after', after);
      const body = object(
        await this.request(`${base}/insights?${params}`, { headers }),
      );
      for (const x of array(body.data)) {
        const r = object(x);
        if (r.date_start !== r.date_stop)
          throw new AdsError('INVALID_REPORT_GRAIN');
        rows.push({
          date: str(r.date_start),
          campaignId: str(r.campaign_id),
          campaignName: str(r.campaign_name),
          micros: micros(r.spend),
        });
      }
      const paging = body.paging ? object(body.paging) : {};
      if (!paging.next) break;
      after = str(object(paging.cursors).after);
      if (seen.has(after) || page === 199) throw new AdsError('PAGE_LIMIT');
      seen.add(after);
    }
    return {
      currency: str(account.currency),
      timeZone: str(account.timezone_name),
      rows,
      campaigns: [
        ...new Map(
          rows.map((r) => [
            r.campaignId,
            { id: r.campaignId, name: r.campaignName },
          ]),
        ).values(),
      ],
    };
  }
  async googleToken(k: Credentials) {
    if (!k.clientId || !k.clientSecret || !k.refreshToken)
      throw new AdsError('OAUTH_REQUIRED');
    const body = object(
      await this.request('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: k.clientId,
          client_secret: k.clientSecret,
          refresh_token: k.refreshToken,
        }).toString(),
      }),
    );
    return str(body.access_token);
  }
  private async google(
    c: AdsConnection,
    k: Credentials,
    from: string,
    to: string,
  ): Promise<Report> {
    const token = await this.googleToken(k);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (c.config.managerId) headers['login-customer-id'] = c.config.managerId;
    const endpoint = `https://googleads.googleapis.com/${c.config.apiVersion || 'v25'}/customers/${c.account_id}/googleAds:search`;
    const search = async (query: string) => {
      const result: Record<string, unknown>[] = [];
      let next = '';
      const seen = new Set<string>();
      for (let p = 0; p < 200; p++) {
        const body = object(
          await this.request(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              query,
              ...(next ? { pageToken: next } : {}),
            }),
          }),
        );
        for (const r of array(body.results ?? [])) result.push(object(r));
        if (!body.nextPageToken) return result;
        next = str(body.nextPageToken);
        if (seen.has(next)) throw new AdsError('PAGE_LIMIT');
        seen.add(next);
      }
      throw new AdsError('PAGE_LIMIT');
    };
    const meta = await search(
      'SELECT customer.id, customer.currency_code, customer.time_zone FROM customer LIMIT 1',
    );
    if (meta.length !== 1) throw new AdsError('ACCOUNT_NOT_FOUND');
    const customer = object(meta[0].customer);
    if (str(customer.id) !== c.account_id)
      throw new AdsError('ACCOUNT_MISMATCH');
    const stats = await search(
      `SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}' AND campaign.status IN ('ENABLED','PAUSED','REMOVED')`,
    );
    const rows = stats.map((r) => {
      const campaign = object(r.campaign),
        amount = str(object(r.metrics).costMicros ?? '0');
      if (!/^\d+$/.test(amount)) throw new AdsError('INVALID_AMOUNT');
      return {
        date: str(object(r.segments).date),
        campaignId: str(campaign.id),
        campaignName: str(campaign.name),
        micros: amount,
      };
    });
    return {
      currency: str(customer.currencyCode),
      timeZone: str(customer.timeZone),
      rows,
      campaigns: [
        ...new Map(
          rows.map((r) => [
            r.campaignId,
            { id: r.campaignId, name: r.campaignName },
          ]),
        ).values(),
      ],
    };
  }
  private async naver(
    c: AdsConnection,
    k: Credentials,
    from: string,
    to: string,
  ): Promise<Report> {
    if (!k.apiKey || !k.secretKey) throw new AdsError('CREDENTIALS_REQUIRED');
    const get = async (path: string, params = new URLSearchParams()) => {
      const stamp = Date.now().toString();
      const signature = createHmac('sha256', k.secretKey)
        .update(`${stamp}.GET.${path}`)
        .digest('base64');
      return this.request(`https://api.searchad.naver.com${path}?${params}`, {
        headers: {
          'X-Timestamp': stamp,
          'X-API-KEY': k.apiKey,
          'X-Customer': c.account_id,
          'X-Signature': signature,
        },
      });
    };
    const campaigns: Array<{ id: string; name: string }> = [];
    let cursor = '';
    const ids = new Set<string>();
    for (let page = 0; page < 6; page++) {
      const params = new URLSearchParams({
        recordSize: '100',
        selector: 'NEXT',
        ...(cursor ? { baseSearchId: cursor } : {}),
      });
      const batch = array(await get('/ncc/campaigns', params));
      for (const item of batch) {
        const r = object(item),
          id = str(r.nccCampaignId);
        if (ids.has(id)) throw new AdsError('PAGE_LIMIT');
        ids.add(id);
        campaigns.push({ id, name: str(r.name) });
      }
      if (campaigns.length > 500) throw new AdsError('CAMPAIGN_LIMIT');
      if (batch.length < 100) break;
      cursor = campaigns[campaigns.length - 1].id;
      if (page === 5) throw new AdsError('PAGE_LIMIT');
    }
    const rows: Spend[] = [];
    for (const date of days(from, to))
      for (const campaign of campaigns) {
        const body = object(
          await get(
            '/stats',
            new URLSearchParams({
              ids: campaign.id,
              fields: JSON.stringify(['salesAmt']),
              timeRange: JSON.stringify({ since: date, until: date }),
            }),
          ),
        );
        const stats = array(body.data);
        if (stats.length !== 1) throw new AdsError('INCOMPLETE_RESPONSE');
        const r = object(stats[0]);
        rows.push({
          date,
          campaignId: campaign.id,
          campaignName: campaign.name,
          micros: micros(r.salesAmt),
        });
      }
    return { currency: 'KRW', timeZone: 'Asia/Seoul', rows, campaigns };
  }
}
