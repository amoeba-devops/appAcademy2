import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ManualInputStatus = 'PENDING' | 'PARTIAL' | 'COMPLETE';

@Entity('amb_acm_dsh_manual_inputs')
export class ManualInputTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'min_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'min_date', type: 'date' })
  date!: string;

  @Column({ name: 'min_marketing_visitor', type: 'int', nullable: true })
  marketingVisitor?: number | null;

  @Column({ name: 'min_marketing_cost', type: 'numeric', precision: 12, scale: 0, nullable: true })
  marketingCost?: string | null;

  @Column({ name: 'min_marketing_effect', type: 'int', nullable: true })
  marketingEffect?: number | null;

  @Column({ name: 'min_cs_complain', type: 'int', nullable: true })
  csComplain?: number | null;

  @Column({ name: 'min_input_status', type: 'varchar', length: 20, default: 'PENDING' })
  status!: ManualInputStatus;

  @Column({ name: 'min_visitor_source', type: 'varchar', length: 100, nullable: true })
  visitorSource?: string | null;

  @Column({ name: 'min_cost_source', type: 'varchar', length: 100, nullable: true })
  costSource?: string | null;

  @Column({ name: 'min_input_note', type: 'text', nullable: true })
  note?: string | null;

  @Column({ name: 'min_input_by', type: 'uuid', nullable: true })
  inputBy?: string | null;

  @Column({ name: 'min_input_at', type: 'timestamptz' })
  inputAt!: Date;

  @Column({ name: 'min_updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'min_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
