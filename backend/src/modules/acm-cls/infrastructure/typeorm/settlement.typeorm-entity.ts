import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type StlStatus = 'DRAFT' | 'CONFIRMED' | 'EXPORTED_TO_PAYROLL' | 'PAID';

@Entity('amb_acm_cls_settlements')
@Index('idx_acm_cls_stl_ent_month_idx', ['entId', 'yearMonth'])
export class SettlementTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'stl_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'stl_teacher_user_id', type: 'uuid' })
  teacherUserId!: string;

  @Column({ name: 'stl_year_month', type: 'varchar', length: 7 })
  yearMonth!: string;

  @Column({
    name: 'stl_hours_total',
    type: 'numeric',
    precision: 6,
    scale: 1,
    default: 0,
  })
  hoursTotal!: string;

  @Column({
    name: 'stl_amount_gross',
    type: 'numeric',
    precision: 12,
    scale: 0,
    default: 0,
  })
  amountGross!: string;

  @Column({
    name: 'stl_withholding_rate',
    type: 'numeric',
    precision: 5,
    scale: 4,
    default: 0.033,
  })
  withholdingRate!: string;

  @Column({
    name: 'stl_amount_withheld',
    type: 'numeric',
    precision: 12,
    scale: 0,
    default: 0,
  })
  amountWithheld!: string;

  @Column({
    name: 'stl_amount_after_tax',
    type: 'numeric',
    precision: 12,
    scale: 0,
    default: 0,
  })
  amountAfterTax!: string;

  @Column({ name: 'stl_status', type: 'varchar', length: 25, default: 'DRAFT' })
  status!: StlStatus;

  @Column({ name: 'stl_confirmed_by', type: 'uuid', nullable: true })
  confirmedBy?: string | null;

  @Column({ name: 'stl_confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt?: Date | null;

  @Column({ name: 'stl_payroll_export_id', type: 'uuid', nullable: true })
  payrollExportId?: string | null;

  @Column({ name: 'stl_computed_at', type: 'timestamptz' })
  computedAt!: Date;

  @Column({ name: 'stl_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'stl_updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
