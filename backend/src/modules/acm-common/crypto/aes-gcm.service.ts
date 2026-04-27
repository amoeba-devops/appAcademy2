import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptedField {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * AES-256-GCM 3-field encryption helper.
 * @see ADR-005
 * Storage convention: {field}_encrypted BYTEA, {field}_iv BYTEA(16), {field}_auth_tag BYTEA(16)
 */
@Injectable()
export class AesGcmService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const keyHex = config.get<string>('ACM_PII_KEY');
    if (!keyHex || keyHex.length !== 64) {
      throw new InternalServerErrorException('ACM_PII_KEY must be 32-byte hex (64 chars)');
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  encrypt(plaintext: string): EncryptedField {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { ciphertext, iv, authTag };
  }

  decrypt(field: EncryptedField): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key, field.iv);
    decipher.setAuthTag(field.authTag);
    return Buffer.concat([decipher.update(field.ciphertext), decipher.final()]).toString('utf8');
  }
}
