import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * REQ-260903E — 테넌트별 카카오 알림톡(Solapi) 설정. ent당 1행.
 * kkc_api_secret_enc: AES-256-GCM [iv(12)][authTag(16)][ciphertext] BYTEA.
 */
@Entity('amb_acm_kakao_config')
@Index('uq_acm_kakao_config_ent', ['entId'], { unique: true })
export class KakaoConfigTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'kkc_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'kkc_api_key', type: 'varchar', length: 100, nullable: true })
  apiKey?: string | null;

  @Column({ name: 'kkc_api_secret_enc', type: 'bytea', nullable: true })
  apiSecretEnc?: Buffer | null;

  @Column({ name: 'kkc_pf_id', type: 'varchar', length: 60, nullable: true })
  pfId?: string | null;

  @Column({ name: 'kkc_template_id', type: 'varchar', length: 60, nullable: true })
  templateId?: string | null;

  @Column({ name: 'kkc_sender_phone', type: 'varchar', length: 20, nullable: true })
  senderPhone?: string | null;

  @Column({ name: 'kkc_sms_fallback', type: 'boolean', default: false })
  smsFallback!: boolean;

  @Column({ name: 'kkc_is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
