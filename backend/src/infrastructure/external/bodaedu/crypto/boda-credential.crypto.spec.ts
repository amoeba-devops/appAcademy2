import {
  decryptBodaCredential,
  deriveBodaKey,
  encryptBodaCredential,
} from './boda-credential.crypto';

describe('boda-credential.crypto', () => {
  describe('deriveBodaKey', () => {
    it('accepts 32-byte hex (64 chars)', () => {
      const key = deriveBodaKey('a'.repeat(64));
      expect(key.length).toBe(32);
    });

    it('throws on missing env', () => {
      expect(() => deriveBodaKey('')).toThrow(/BODA_CRYPTO_KEY/);
      expect(() => deriveBodaKey(undefined)).toThrow(/BODA_CRYPTO_KEY/);
    });

    it('falls back to scrypt for non-hex passphrase (test convenience)', () => {
      const key = deriveBodaKey('test-passphrase');
      expect(key.length).toBe(32);
    });
  });

  describe('round-trip', () => {
    const key = deriveBodaKey('a'.repeat(64));

    it('encrypts then decrypts back to original string', () => {
      const blob = encryptBodaCredential('hello-world', key);
      expect(blob).toBeInstanceOf(Buffer);
      expect(blob.length).toBeGreaterThan(1 + 12 + 16);
      const plaintext = decryptBodaCredential(blob, key);
      expect(plaintext).toBe('hello-world');
    });

    it('produces fresh IV every call (no determinism leakage)', () => {
      const a = encryptBodaCredential('payload', key);
      const b = encryptBodaCredential('payload', key);
      expect(a.equals(b)).toBe(false);
    });

    it('supports unicode plaintext (Korean)', () => {
      const blob = encryptBodaCredential('보다에듀 인증키', key);
      expect(decryptBodaCredential(blob, key)).toBe('보다에듀 인증키');
    });
  });

  describe('tamper resistance', () => {
    const key = deriveBodaKey('b'.repeat(64));

    it('rejects when ciphertext byte flipped (AuthTag fail)', () => {
      const blob = encryptBodaCredential('secret', key);
      const tampered = Buffer.from(blob);
      tampered[tampered.length - 1] ^= 0xff;
      expect(() => decryptBodaCredential(tampered, key)).toThrow();
    });

    it('rejects when wrong key used', () => {
      const blob = encryptBodaCredential('secret', key);
      const wrongKey = deriveBodaKey('c'.repeat(64));
      expect(() => decryptBodaCredential(blob, wrongKey)).toThrow();
    });

    it('rejects blob shorter than header', () => {
      expect(() => decryptBodaCredential(Buffer.from([0x01]), key)).toThrow();
    });

    it('rejects unknown version byte', () => {
      const blob = encryptBodaCredential('secret', key);
      const wrongVersion = Buffer.from(blob);
      wrongVersion[0] = 0x99;
      expect(() => decryptBodaCredential(wrongVersion, key)).toThrow(/version/);
    });
  });

  describe('key sanity', () => {
    it('throws if encryption key not 32 bytes', () => {
      const shortKey = Buffer.alloc(16);
      expect(() => encryptBodaCredential('x', shortKey)).toThrow(/32 bytes/);
    });
  });
});
