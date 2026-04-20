import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PayOrderEntity } from './pay-order.entity';

@Entity('tac_pay_receipts')
export class PayReceiptEntity {
  @PrimaryGeneratedColumn({ name: 'rct_id', type: 'bigint', unsigned: true })
  rctId: number;

  @Column({ name: 'pod_id', type: 'bigint', unsigned: true })
  podId: number;

  @Column({ name: 'rct_receipt_type', type: 'varchar', length: 20 })
  rctReceiptType: string;

  @Column({ name: 'rct_issued_at', type: 'datetime' })
  rctIssuedAt: Date;

  @Column({ name: 'rct_pdf_url', type: 'varchar', length: 500, nullable: true })
  rctPdfUrl: string | null;

  @Column({ name: 'rct_cash_receipt_no', type: 'varchar', length: 64, nullable: true })
  rctCashReceiptNo: string | null;

  @Column({ name: 'rct_buyer_identifier', type: 'varbinary', length: 128, nullable: true })
  rctBuyerIdentifier: Buffer | null;

  @Column({ name: 'rct_canceled_at', type: 'datetime', nullable: true })
  rctCanceledAt: Date | null;

  @ManyToOne(() => PayOrderEntity, (o) => o.receipts)
  @JoinColumn({ name: 'pod_id' })
  order: PayOrderEntity;
}
