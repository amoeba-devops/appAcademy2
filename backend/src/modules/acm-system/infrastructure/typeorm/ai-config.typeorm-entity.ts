import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AiProvider =
  | 'OPENAI'
  | 'ANTHROPIC'
  | 'GOOGLE_GEMINI'
  | 'CUSTOM_OPENAI_COMPATIBLE';

@Entity('amb_acm_system_ai_config')
@Index('uq_acm_system_ai_config_ent', ['entId'], { unique: true })
export class AiConfigTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'aic_id' }) id!: string;
  @Column({ name: 'ent_id', type: 'uuid' }) entId!: string;
  @Column({ name: 'aic_provider', type: 'varchar', length: 40 }) provider!: AiProvider;
  @Column({ name: 'aic_model_id', type: 'varchar', length: 120 }) modelId!: string;
  @Column({ name: 'aic_api_key_enc', type: 'bytea', nullable: true }) apiKeyEnc?: Buffer | null;
  @Column({ name: 'aic_base_url', type: 'varchar', length: 500, nullable: true }) baseUrl?: string | null;
  @Column({ name: 'aic_org_project_id', type: 'varchar', length: 200, nullable: true }) orgProjectId?: string | null;
  @Column({ name: 'aic_is_active', type: 'boolean', default: false }) isActive!: boolean;
  @Column({ name: 'aic_last_test_status', type: 'varchar', length: 20, nullable: true }) lastTestStatus?: 'SUCCESS' | 'FAILED' | null;
  @Column({ name: 'aic_last_tested_at', type: 'timestamptz', nullable: true }) lastTestedAt?: Date | null;
  @Column({ name: 'aic_last_test_message', type: 'varchar', length: 500, nullable: true }) lastTestMessage?: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' }) updatedAt!: Date;
}
