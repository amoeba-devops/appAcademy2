/**
 * BODA Webhook 출발지 IP 화이트리스트 검증 (FR-EVENT-2).
 *
 * BODA 가 HMAC 서명을 미지원하는 동안의 임시 방어책. CIDR (`/24`) 또는
 * 단일 IP 표기 모두 지원. IPv4 만 고려 (v6 는 거의 안 옴 — 들어와도 false).
 *
 * `allowed` 가 비어있으면 (`""`) `{ allowed: false, reason: 'NO_ALLOWLIST' }` —
 * Webhook 컨트롤러가 통과시킬지 fail-closed 할지 결정.
 */

export interface AllowResult {
  allowed: boolean;
  reason?: 'EMPTY_ALLOWLIST' | 'NOT_IN_ALLOWLIST' | 'INVALID_IP';
}

/**
 * @param srcIp  요청 원격지 IP (`req.ip` 또는 `X-Forwarded-For` 의 첫 항목).
 * @param allowedCsv  콤마 구분 CIDR/IP 목록. ex: `"1.2.3.4,5.6.7.0/24"`.
 *                    공백/빈 항목은 무시.
 */
export function isIpInBodaAllowlist(
  srcIp: string | undefined | null,
  allowedCsv: string | undefined | null,
): AllowResult {
  if (!srcIp) return { allowed: false, reason: 'INVALID_IP' };
  if (!allowedCsv || !allowedCsv.trim()) {
    return { allowed: false, reason: 'EMPTY_ALLOWLIST' };
  }
  const srcLong = ipv4ToLong(srcIp);
  if (srcLong === null) return { allowed: false, reason: 'INVALID_IP' };

  const items = allowedCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const item of items) {
    if (item.includes('/')) {
      if (ipv4InCidr(srcLong, item)) return { allowed: true };
    } else {
      const ruleLong = ipv4ToLong(item);
      if (ruleLong !== null && ruleLong === srcLong) return { allowed: true };
    }
  }
  return { allowed: false, reason: 'NOT_IN_ALLOWLIST' };
}

// ---------------------------------------------------------------------

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let acc = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    acc = (acc << 8) + n;
  }
  // bit-shift on 32-bit signed → coerce to unsigned for comparisons.
  return acc >>> 0;
}

function ipv4InCidr(srcLong: number, cidr: string): boolean {
  const [base, bits] = cidr.split('/');
  const mask = Number(bits);
  if (!Number.isInteger(mask) || mask < 0 || mask > 32) return false;
  const baseLong = ipv4ToLong(base);
  if (baseLong === null) return false;
  if (mask === 0) return true; // 0.0.0.0/0 — full open (rare but valid)
  const maskBits = (0xffffffff << (32 - mask)) >>> 0;
  return (srcLong & maskBits) === (baseLong & maskBits);
}
