import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * REQ-260902B — 테넌트별 메일(SMTP) 설정. ent당 1행.
 * mlc_password_enc: AES-256-GCM [iv(12)][authTag(16)][ciphertext] BYTEA
 * (amb_acm_ama_config 시크릿과 동일 코덱).
 */
@Entity('amb_acm_mail_config')
@Index('uq_acm_mail_config_ent', ['entId'], { unique: true })
export class MailConfigTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mlc_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'mlc_host', type: 'varchar', length: 200, default: 'smtp.gmail.com' })
  host!: string;

  @Column({ name: 'mlc_port', type: 'int', default: 587 })
  port!: number;

  @Column({ name: 'mlc_secure', type: 'boolean', default: false })
  secure!: boolean;

  @Column({ name: 'mlc_username', type: 'varchar', length: 200, nullable: true })
  username?: string | null;

  @Column({ name: 'mlc_password_enc', type: 'bytea', nullable: true })
  passwordEnc?: Buffer | null;

  @Column({ name: 'mlc_from_name', type: 'varchar', length: 100, nullable: true })
  fromName?: string | null;

  @Column({ name: 'mlc_from_address', type: 'varchar', length: 200, nullable: true })
  fromAddress?: string | null;

  @Column({ name: 'mlc_is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
