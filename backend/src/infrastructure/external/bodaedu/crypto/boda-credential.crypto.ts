import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

/**
 * AES-256-GCM 암복호화 — BODA 자격증명 (authKey · webhook event secret) 저장용.
 *
 * Master key 는 `ACM_PII_KEY` 와 동일한 보관 정책 (NFR-3): 32-byte hex env,
 * 절대 코드/로그/응답 노출 금지. 기존 PII 모듈과 키를 공유하지 않고 별도
 * env (`BODA_CRYPTO_KEY`) 를 두는 이유는 도메인 분리 + 회전 독립성.
 *
 * 저장 포맷 (single Buffer):
 *   [ 1 byte version ] [ 12 byte IV ] [ 16 byte AuthTag ] [ ciphertext ]
 *
 * 운영 회전:
 *   1. 새 키 생성 → BODA_CRYPTO_KEY_NEW env 로 임시 보관
 *   2. cron / admin endpoint 가 행 단위 재암호화 (decrypt 구 → encrypt 신)
 *   3. 모든 행 마이그레이션 완료 후 BODA_CRYPTO_KEY 로 promote
 *
 * 1 회 회전 완료 전까지 두 키 모두 보관 — 본 유틸은 단일 키 시점 가정.
 * 회전 별건 추가 (PLN-260526 § Non-Goal 외).
 */

const VERSION = 0x01;
const IV_LEN = 12;
const TAG_LEN = 16;

/**
 * 32-byte (64 hex) key string from env → Buffer. Throws if malformed.
 * Same shape as ACM_PII_KEY (REQ-260604 deploy lesson).
 */
export function deriveBodaKey(envValue: string | undefined | null): Buffer {
  if (!envValue) {
    throw new Error('BODA_CRYPTO_KEY missing');
  }
  if (envValue.length === 64 && /^[0-9a-fA-F]+$/.test(envValue)) {
    return Buffer.from(envValue, 'hex');
  }
  // Fallback: derive from arbitrary passphrase via scrypt (test fixtures use this).
  return scryptSync(envValue, 'boda-credential-salt', 32);
}

export function encryptBodaCredential(plaintext: string, key: Buffer): Buffer {
  if (key.length !== 32) {
    throw new Error('boda crypto key must be 32 bytes');
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ct]);
}

export function decryptBodaCredential(blob: Buffer, key: Buffer): string {
  if (key.length !== 32) {
    throw new Error('boda crypto key must be 32 bytes');
  }
  if (blob.length < 1 + IV_LEN + TAG_LEN) {
    throw new Error('boda credential blob too short');
  }
  const version = blob[0];
  if (version !== VERSION) {
    throw new Error(`unsupported boda credential blob version: ${version}`);
  }
  const iv = blob.subarray(1, 1 + IV_LEN);
  const tag = blob.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ct = blob.subarray(1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}
