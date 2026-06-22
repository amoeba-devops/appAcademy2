import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PayOrderTypeormEntity } from './pay-order.typeorm-entity';

export type PayReceiptType = 'CASH_RECEIPT' | 'SIMPLE';

/**
 * 영수증 — 간이 / 현금영수증 (세금계산서는 별도 PayTaxInvoice 테이블).
 *
 * `buyerIdentifier` 는 휴대폰 / 주민번호 같은 PII — AES-GCM 으로 암호화된
 * Buffer 그대로 저장. 복호화는 외부 NTS 호출 직전에만 메모리에서 수행.
 *
 * @see sql/acm/950-acm-pay-schema.sql §5
 * @see NFR-005 (PII 암호화)
 */
@Entity('amb_acm_pay_receipt')
@Index('idx_acm_pay_receipt_order', ['orderId'])
export class PayReceiptTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'rct_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'pod_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => PayOrderTypeormEntity)
  @JoinColumn({ name: 'pod_id', referencedColumnName: 'id' })
  order?: PayOrderTypeormEntity;

  @Column({ name: 'rct_receipt_type', type: 'varchar', length: 20 })
  receiptType!: PayReceiptType;

  @Column({ name: 'rct_issued_at', type: 'timestamptz' })
  issuedAt!: Date;

  @Column({ name: 'rct_pdf_url', type: 'varchar', length: 500, nullable: true })
  pdfUrl?: string | null;

  @Column({ name: 'rct_cash_receipt_no', type: 'varchar', length: 64, nullable: true })
  cashReceiptNo?: string | null;

  /** AES-GCM ciphertext (휴대폰/주민번호). 평문 노출 금지. */
  @Column({ name: 'rct_buyer_identifier', type: 'bytea', nullable: true })
  buyerIdentifier?: Buffer | null;

  @Column({ name: 'rct_canceled_at', type: 'timestamptz', nullable: true })
  canceledAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
