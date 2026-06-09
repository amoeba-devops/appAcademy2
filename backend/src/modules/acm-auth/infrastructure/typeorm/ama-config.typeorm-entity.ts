import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * AMA 연동 설정 — AMA 커스텀앱 SSO 로그인 게이트의 단일 진실원천.
 *
 * 어드민이 `/admin/config` 에서 등록한 (entityId, appCode) 를 보관한다. 로그인
 * 시 토큰의 `entityId`+`appCode` 가 active 행과 일치할 때만 허용 (REQ-260609B
 * FR-3). 값은 비밀이 아닌 비교용 공개 식별자이므로 평문 저장.
 *
 * 1 row per (ent_id). 로그인 게이트는 `amaEntityId`(=토큰 entityId)로 조회.
 *
 * @see sql/acm/920-acm-ama-config.sql
 */
@Entity('amb_acm_ama_config')
@Index('uq_acm_ama_config_ent', ['entId'], { unique: true })
@Index('uq_acm_ama_config_entity', ['amaEntityId'], { unique: true })
export class AmaConfigTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'amc_id' })
  id!: string;

  /** 어드민 CRUD 스코프(테넌트). 보통 amaEntityId 와 동일. */
  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  /** JWT `entityId` 와 비교할 값 (AMA 법인 entityId). */
  @Column({ name: 'amc_ama_entity_id', type: 'varchar', length: 80 })
  amaEntityId!: string;

  /** JWT `appCode` 와 비교할 값 (커스텀앱 등록명, 예 'tpi-acm'). */
  @Column({ name: 'amc_app_code', type: 'varchar', length: 60 })
  appCode!: string;

  /** false → 이 설정으로의 로그인 전면 차단 (fail-closed). */
  @Column({ name: 'amc_is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
