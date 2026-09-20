/**
 * BODA Webhook 발신 IP 판정 (REQ-260920C B-1).
 *
 * 벤더가 이벤트 인증 수단(시크릿/서명)을 제공하지 않아 **IP allowlist 가
 * 유일한 인증**이다. 따라서 어떤 IP 를 "발신지"로 볼지가 곧 인증 강도다.
 *
 * 운영 토폴로지 (staging·production 동일, 2홉):
 *
 *   BODA ──▶ host nginx ──▶ 컨테이너 nginx(frontend-acm) ──▶ backend
 *              (hop 1)           (hop 2)
 *
 * 각 nginx 는 `$proxy_add_x_forwarded_for` 로 **자기 peer 의 IP 를 뒤에 append**
 * 한다. 그래서 backend 가 받는 `X-Forwarded-For` 는
 *
 *   [ (클라이언트가 임의로 넣은 값들...), <실제 발신 IP>, <host nginx IP> ]
 *
 * 꼴이 된다. 첫 항목을 쓰면 클라이언트가 `X-Forwarded-For: 121.170.164.136`
 * 을 붙여 보내는 것만으로 allowlist 를 우회할 수 있다. 신뢰할 수 있는 값은
 * **뒤에서 `trustedHops` 번째** 항목뿐이다.
 *
 * `X-Real-IP` 는 컨테이너 nginx 가 host nginx 의 주소(127.0.0.1)로 덮어쓰므로
 * 쓸 수 없다.
 */

/**
 * @param xff        `X-Forwarded-For` 헤더 원문 (string | string[] | undefined).
 * @param socketIp   프록시를 거치지 않은 경우의 소켓 원격지 (`req.ip`).
 * @param trustedHops backend 앞에 있는, XFF 를 append 하는 신뢰 프록시 수.
 *                    운영 = 2. 0 이면 XFF 를 무시하고 소켓 IP 만 쓴다.
 * @returns 정규화된 IPv4 문자열. 판정 불가 시 빈 문자열 (allowlist 가 INVALID_IP
 *          로 거부).
 */
export function resolveWebhookSourceIp(
  xff: string | string[] | undefined,
  socketIp: string | undefined | null,
  trustedHops: number,
): string {
  const hops =
    Number.isInteger(trustedHops) && trustedHops > 0 ? trustedHops : 0;
  if (hops === 0) return normalizeIp(socketIp);

  const raw = Array.isArray(xff) ? xff.join(',') : (xff ?? '');
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // 신뢰 프록시를 전부 거쳤다면 항목이 최소 hops 개 있어야 한다. 부족하면
  // 프록시를 우회해 backend 에 직접 닿은 요청이므로 소켓 IP 가 곧 발신지다.
  if (items.length < hops) return normalizeIp(socketIp);
  return normalizeIp(items[items.length - hops]);
}

/** `::ffff:1.2.3.4` (IPv4-mapped IPv6) → `1.2.3.4`. 그 외는 trim 만. */
export function normalizeIp(ip: string | undefined | null): string {
  if (!ip) return '';
  const s = ip.trim();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(s);
  return mapped ? mapped[1] : s;
}

/** env `BODA_WEBHOOK_TRUSTED_PROXY_HOPS` 파싱 — 미설정/비정상 시 기본 2홉. */
export const DEFAULT_TRUSTED_PROXY_HOPS = 2;

export function parseTrustedHops(raw: string | undefined | null): number {
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_TRUSTED_PROXY_HOPS;
  }
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_TRUSTED_PROXY_HOPS;
}
