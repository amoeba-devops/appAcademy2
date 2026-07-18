import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('amb_acm_cls_settlement_lines')
@Index('idx_acm_cls_stl_line_stl_idx', ['stlId'])
export class SettlementLineTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'stl_line_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'stl_id', type: 'uuid' })
  stlId!: string;

  @Column({ name: 'cls_id', type: 'uuid' })
  clsId!: string;

  @Column({ name: 'ses_id', type: 'uuid' })
  sesId!: string;

  @Column({ name: 'cst_id', type: 'uuid' })
  cstId!: string;

  @Column({ name: 'stl_line_session_date', type: 'date' })
  sessionDate!: string;

  @Column({
    name: 'stl_line_billable_hours',
    type: 'numeric',
    precision: 3,
    scale: 1,
  })
  billableHours!: string;

  @Column({
    name: 'stl_line_hourly_rate',
    type: 'numeric',
    precision: 10,
    scale: 0,
  })
  hourlyRate!: string;

  @Column({ name: 'stl_line_amount', type: 'numeric', precision: 12, scale: 0 })
  amount!: string;

  @Column({ name: 'stl_line_created_at', type: 'timestamptz' })
  createdAt!: Date;
}
