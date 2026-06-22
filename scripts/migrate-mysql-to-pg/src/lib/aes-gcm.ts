import { createDecipheriv } from 'crypto';
import { Logger } from './logger';

/**
 * AES-256-GCM decryptor — mirror of backend/src/modules/acm-common/crypto/
 * aes-gcm.service.ts. Used by the CSL inquiry backfill to decrypt PG-side
 * encrypted name/phone fields and match against legacy MySQL plaintext.
 *
 * Why duplicated: the migration runner is a standalone Node script that
 * doesn't boot the NestJS app, so we can't @Inject AesGcmService. Behavior
 * MUST stay byte-identical to the NestJS service or matches will diverge.
 *
 * Storage convention (ADR-005):
 *   {field}_encrypted BYTEA  (ciphertext)
 *   {field}_iv        BYTEA  (12 bytes)
 *   {field}_auth_tag  BYTEA  (16 bytes)
 */
export class AesGcm {
  private readonly log = new Logger('aes-gcm');
  private readonly key: Buffer | null;

  constructor(keyHex: string | undefined | null) {
    if (!keyHex || keyHex.length !== 64) {
      this.log.warn('ACM_PII_KEY not set or not 32-byte hex — decryption disabled');
      this.key = null;
      return;
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  get enabled(): boolean {
    return this.key !== null;
  }

  /** Returns null when the key is missing or any auth check fails. */
  decrypt(
    ciphertext: Buffer | null,
    iv: Buffer | null,
    authTag: Buffer | null,
  ): string | null {
    if (!this.key || !ciphertext || !iv || !authTag) return null;
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
    } catch (e) {
      this.log.warn(`decrypt failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }
}

/** Q-5 status enum map — tac_consultations.cst_status → amb_acm_csl_inquiry stage. */
export function mapInquiryStage(mysqlStatus: string | null): string {
  switch ((mysqlStatus ?? '').toUpperCase()) {
    case 'PENDING':
    case 'OPEN':            return 'INTAKE';
    case 'IN_PROGRESS':     return 'ENROLLMENT_COUNSELING';
    case 'CONVERTED':       return 'CLASS_STARTED';
    case 'DROPPED':
    case 'CLOSED':          return 'DROPPED';
    default:                return 'INTAKE';
  }
}

/** Normalize phone for comparison: strip spaces/dashes/parens. */
export function normalizePhone(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/[\s\-()]/g, '');
}
