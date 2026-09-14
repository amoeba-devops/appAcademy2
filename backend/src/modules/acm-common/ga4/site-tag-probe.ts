import { Injectable, Logger } from '@nestjs/common';

/**
 * PLN-260914C — 공개 사이트 HTML 을 1회 GET 해 GA4 측정 ID(G-…) 가 렌더링됐는지 확인한다.
 * 네트워크 실패·타임아웃은 오류가 아니라 installed=null("확인 불가") 로 보고한다.
 */
export interface TagProbeResult {
  installed: boolean | null;
  foundIds: string[];
  error: string | null;
}

const TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 ACM-GA4-Probe';
const MEASUREMENT_ID_RE = /G-[A-Z0-9]{6,12}/g;

@Injectable()
export class SiteTagProbe {
  private readonly log = new Logger(SiteTagProbe.name);

  async probeTag(url: string, measurementId: string): Promise<TagProbeResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.8' },
      });
      if (!res.ok) {
        return { installed: null, foundIds: [], error: `HTTP_${res.status}` };
      }
      const text = (await res.text()).slice(0, MAX_BYTES);
      const found = [...new Set(text.match(MEASUREMENT_ID_RE) ?? [])];
      const want = measurementId.trim().toUpperCase();
      return { installed: found.includes(want), foundIds: found, error: null };
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      const msg =
        err?.name === 'AbortError' ? 'TIMEOUT' : (err?.message ?? String(e));
      this.log.warn(`tag probe failed url=${url}: ${msg}`);
      return { installed: null, foundIds: [], error: msg.slice(0, 200) };
    } finally {
      clearTimeout(timer);
    }
  }
}
