import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProgramTypeormEntity } from './program.typeorm-entity';

const numericMoneyTransformer = {
  to: (n: number | null | undefined): string | null => (n == null ? null : n.toFixed(2)),
  from: (s: string | null): number | null => (s == null ? null : Number(s)),
};

/** @see sql/acm/970-acm-posts-schema.sql §3 — 프로그램 수강료 / 정원 / 환불정책 JSONB */
@Entity('amb_acm_program_setting')
export class ProgramSettingTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'pgs_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'prg_id', type: 'uuid', unique: true })
  programId!: string;

  @OneToOne(() => ProgramTypeormEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prg_id', referencedColumnName: 'id' })
  program?: ProgramTypeormEntity;

  @Column({
    name: 'pgs_fee_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: numericMoneyTransformer,
  })
  feeAmount?: number | null;

  @Column({ name: 'pgs_fee_currency', type: 'char', length: 3, default: 'KRW' })
  feeCurrency!: string;

  @Column({ name: 'pgs_capacity_max', type: 'integer', nullable: true })
  capacityMax?: number | null;

  @Column({ name: 'pgs_session_count', type: 'integer', nullable: true })
  sessionCount?: number | null;

  @Column({ name: 'pgs_material_info', type: 'jsonb', nullable: true })
  materialInfo?: unknown | null;

  @Column({ name: 'pgs_refund_policy', type: 'jsonb', nullable: true })
  refundPolicy?: unknown | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
