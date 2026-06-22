import { createCipheriv, randomBytes } from 'crypto';
import {
  AesGcm,
  mapInquiryStage,
  normalizePhone,
} from '../../../scripts/migrate-mysql-to-pg/src/lib/aes-gcm';

/**
 * Behaviors covered:
 *  1. AesGcm decrypt — round-trip identity with a known key
 *  2. AesGcm decrypt — returns null when key missing
 *  3. AesGcm decrypt — returns null when authTag tampered (auth-fail safe)
 *  4. mapInquiryStage — Q-5 enum table (case-insensitive, default = INTAKE)
 *  5. normalizePhone — strips spaces/dashes/parens, null-safe
 */
describe('migration-runner :: aes-gcm + helpers', () => {
  const keyHex = randomBytes(32).toString('hex');

  function encrypt(key: Buffer, plaintext: string): {
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
  } {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf-8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return { ciphertext, iv, authTag };
  }

  it('decrypt round-trips with the same key', () => {
    const aes = new AesGcm(keyHex);
    const enc = encrypt(Buffer.from(keyHex, 'hex'), '홍길동');
    expect(aes.decrypt(enc.ciphertext, enc.iv, enc.authTag)).toBe('홍길동');
  });

  it('decrypt returns null when key missing', () => {
    const aes = new AesGcm(null);
    expect(aes.enabled).toBe(false);
    const enc = encrypt(Buffer.from(keyHex, 'hex'), 'x');
    expect(aes.decrypt(enc.ciphertext, enc.iv, enc.authTag)).toBeNull();
  });

  it('decrypt returns null when authTag is tampered (auth fail does not throw)', () => {
    const aes = new AesGcm(keyHex);
    const enc = encrypt(Buffer.from(keyHex, 'hex'), 'name');
    const tampered = Buffer.from(enc.authTag);
    tampered[0] ^= 0xff;
    expect(aes.decrypt(enc.ciphertext, enc.iv, tampered)).toBeNull();
  });

  it('mapInquiryStage covers the Q-5 enum table', () => {
    expect(mapInquiryStage('PENDING')).toBe('INTAKE');
    expect(mapInquiryStage('OPEN')).toBe('INTAKE');
    expect(mapInquiryStage('IN_PROGRESS')).toBe('ENROLLMENT_COUNSELING');
    expect(mapInquiryStage('CONVERTED')).toBe('CLASS_STARTED');
    expect(mapInquiryStage('DROPPED')).toBe('DROPPED');
    expect(mapInquiryStage('CLOSED')).toBe('DROPPED');
    // case + null + unknown all fall back to INTAKE
    expect(mapInquiryStage('converted')).toBe('CLASS_STARTED');
    expect(mapInquiryStage(null)).toBe('INTAKE');
    expect(mapInquiryStage('UNRECOGNIZED')).toBe('INTAKE');
  });

  it('normalizePhone strips formatting + null-safe', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678');
    expect(normalizePhone('(02) 555 1234')).toBe('025551234');
    expect(normalizePhone('  +82 10 1234 5678  ')).toBe('+821012345678');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone('')).toBe('');
  });
});
