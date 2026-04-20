import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ProgramEntity } from './program.entity';

@Entity('tac_program_settings')
export class ProgramSettingEntity {
  @PrimaryGeneratedColumn({ name: 'pgs_id', type: 'bigint', unsigned: true })
  pgsId: number;

  @Column({ name: 'prg_id', type: 'bigint', unsigned: true })
  prgId: number;

  @Column({ name: 'pgs_fee_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  pgsFeeAmount: string | null;

  @Column({ name: 'pgs_fee_currency', type: 'char', length: 3, default: 'KRW' })
  pgsFeeCurrency: string;

  @Column({ name: 'pgs_capacity_max', type: 'int', nullable: true })
  pgsCapacityMax: number | null;

  @Column({ name: 'pgs_session_count', type: 'int', nullable: true })
  pgsSessionCount: number | null;

  @Column({ name: 'pgs_material_info', type: 'json', nullable: true })
  pgsMaterialInfo: any | null;

  @Column({ name: 'pgs_refund_policy', type: 'json', nullable: true })
  pgsRefundPolicy: any | null;

  @UpdateDateColumn({ name: 'pgs_updated_at' })
  pgsUpdatedAt: Date;

  @OneToOne(() => ProgramEntity, (p) => p.setting)
  @JoinColumn({ name: 'prg_id' })
  program: ProgramEntity;
}
