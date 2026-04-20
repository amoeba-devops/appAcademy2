import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';
import { PayRefundPolicyTierEntity } from './pay-refund-policy-tier.entity';

@Entity('tac_pay_refund_policies')
export class PayRefundPolicyEntity {
  @PrimaryGeneratedColumn({ name: 'rfp_id', type: 'bigint', unsigned: true })
  rfpId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'rfp_version', type: 'int' })
  rfpVersion: number;

  @Column({ name: 'rfp_basis', type: 'varchar', length: 20, default: 'SESSION' })
  rfpBasis: string;

  @Column({ name: 'rfp_label', type: 'varchar', length: 100 })
  rfpLabel: string;

  @Column({ name: 'rfp_effective_from', type: 'date' })
  rfpEffectiveFrom: string;

  @Column({ name: 'rfp_effective_to', type: 'date', nullable: true })
  rfpEffectiveTo: string | null;

  @Column({ name: 'rfp_is_default_template', type: 'tinyint', default: 0 })
  rfpIsDefaultTemplate: number;

  @Column({ name: 'rfp_created_by', type: 'bigint', unsigned: true, nullable: true })
  rfpCreatedBy: number | null;

  @CreateDateColumn({ name: 'rfp_created_at' })
  rfpCreatedAt: Date;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @OneToMany(() => PayRefundPolicyTierEntity, (t) => t.policy)
  tiers: PayRefundPolicyTierEntity[];
}
