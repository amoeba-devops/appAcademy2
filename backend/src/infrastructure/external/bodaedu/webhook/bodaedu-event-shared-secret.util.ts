/**
 * BODA Webhook 인증 — Shared-Secret 헤더 검증.
 *
 * Vendor docs (SPEC_823 v823.002) 시점에는 HMAC 서명이 명세되지 않았다.
 * 본 util 은 임시 정책 (FR-EVENT-2):
 *   - constant-time 비교로 token 일치 확인
 *   - 헤더 누락 / 빈 값 / 미일치 모두 동일 `INVALID_TOKEN` 으로 응답 (timing
 *     공격 방지)
 *
 * Q2 (REQ §11) 회신 후 HMAC 가능해지면 `verifyAmaWebhook` 패턴을 차용하여
 * 이 모듈을 deprecate.
 */

import { timingSafeEqual } from 'crypto';

export interface VerifyResult {
  ok: boolean;
  /** ok=false 일 때 사유 — log 용. 응답 body 에는 노출하지 않는다. */
  reason?: 'MISSING_TOKEN' | 'INVALID_TOKEN' | 'NO_SHARED_SECRET';
}

/**
 * @param sharedSecret  서버 측 저장 비밀 (env / DB 복호화 결과). 빈 문자열이면
 *                      verification 자체가 의미 없으므로 `NO_SHARED_SECRET` 반환.
 * @param receivedToken Webhook 헤더 (예: `X-Boda-Token`) 값. undefined 가능.
 */
export function verifyBodaWebhookToken(
  sharedSecret: string,
  receivedToken: string | undefined | null,
): VerifyResult {
  if (!sharedSecret) {
    return { ok: false, reason: 'NO_SHARED_SECRET' };
  }
  if (!receivedToken) {
    return { ok: false, reason: 'MISSING_TOKEN' };
  }
  // Equalize length to avoid timingSafeEqual throwing on length mismatch.
  const a = Buffer.from(receivedToken);
  const b = Buffer.from(sharedSecret);
  if (a.length !== b.length) {
    // length mismatch is itself a signal — but expose nothing extra in API.
    return { ok: false, reason: 'INVALID_TOKEN' };
  }
  return timingSafeEqual(a, b)
    ? { ok: true }
    : { ok: false, reason: 'INVALID_TOKEN' };
}
