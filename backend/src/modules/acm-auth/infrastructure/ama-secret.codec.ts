import type { EncryptedField } from '../../acm-common/crypto/aes-gcm.service';

/**
 * Pack/unpack an AES-GCM EncryptedField into a single BYTEA blob for storage
 * (REQ-260609D). Layout: [iv(12)][authTag(16)][ciphertext].
 */
const IV_LEN = 12;
const TAG_LEN = 16;

export function packEncrypted(f: EncryptedField): Buffer {
  return Buffer.concat([f.iv, f.authTag, f.ciphertext]);
}

export function unpackEncrypted(blob: Buffer): EncryptedField {
  return {
    iv: blob.subarray(0, IV_LEN),
    authTag: blob.subarray(IV_LEN, IV_LEN + TAG_LEN),
    ciphertext: blob.subarray(IV_LEN + TAG_LEN),
  };
}
