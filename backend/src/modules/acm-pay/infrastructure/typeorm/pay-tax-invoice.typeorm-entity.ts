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

const numericMoneyTransformer = {
  to: (n: number | null): string | null => (n == null ? null : n.toFixed(2)),
  from: (s: string | null): number | null => (s == null ? null : Number(s)),
};

export type PayTaxInvoiceStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELED';

export type PayTaxInvoiceBuyerType = 'CORP' | 'INDIVIDUAL';

/**
 * 세금계산서 — NTS eTax API 직결 (FR-048).
 *
 * 본 시스템이 직접 발행 + NTS 서버에 XML 제출. 공동인증서는 별도 KMS
 * envelope 으로 보관 (ADR-003) — 본 엔티티는 결과만 추적.
 *
 * @see sql/acm/950-acm-pay-schema.sql §6
 */
@Entity('amb_acm_pay_tax_invoice')
@Index('uq_acm_pay_tax_invoice_ent_no', ['entId', 'invoiceNo'], { unique: true })
@Index('idx_acm_pay_tax_invoice_order', ['orderId'])
@Index('idx_acm_pay_tax_invoice_status_date', ['status', 'ntsSubmittedAt'])
export class PayTaxInvoiceTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'txi_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'pod_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => PayOrderTypeormEntity)
  @JoinColumn({ name: 'pod_id', referencedColumnName: 'id' })
  order?: PayOrderTypeormEntity;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  /** Internal — `academy-YYYY-seq` format. */
  @Column({ name: 'txi_invoice_no', type: 'varchar', length: 40 })
  invoiceNo!: string;

  /** NTS 발급승인번호 — APPROVED 이후 채워짐. */
  @Column({ name: 'txi_nts_issue_no', type: 'varchar', length: 24, nullable: true })
  ntsIssueNo?: string | null;

  @Column({ name: 'txi_supplier_biz_no', type: 'varchar', length: 13 })
  supplierBizNo!: string;

  @Column({ name: 'txi_buyer_biz_no', type: 'varchar', length: 13, nullable: true })
  buyerBizNo?: string | null;

  @Column({ name: 'txi_buyer_type', type: 'varchar', length: 20 })
  buyerType!: PayTaxInvoiceBuyerType;

  @Column({
    name: 'txi_supply_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericMoneyTransformer,
  })
  supplyAmount!: number;

  @Column({
    name: 'txi_tax_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericMoneyTransformer,
  })
  taxAmount!: number;

  @Column({
    name: 'txi_total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericMoneyTransformer,
  })
  totalAmount!: number;

  @Column({ name: 'txi_issue_date', type: 'date' })
  issueDate!: string;

  @Column({ name: 'txi_status', type: 'varchar', length: 20, default: 'DRAFT' })
  status!: PayTaxInvoiceStatus;

  @Column({ name: 'txi_nts_submitted_at', type: 'timestamptz', nullable: true })
  ntsSubmittedAt?: Date | null;

  @Column({ name: 'txi_nts_approved_at', type: 'timestamptz', nullable: true })
  ntsApprovedAt?: Date | null;

  @Column({ name: 'txi_nts_error_code', type: 'varchar', length: 30, nullable: true })
  ntsErrorCode?: string | null;

  @Column({ name: 'txi_nts_error_message', type: 'varchar', length: 500, nullable: true })
  ntsErrorMessage?: string | null;

  /** S3: signed eTax XML. */
  @Column({ name: 'txi_xml_payload_url', type: 'varchar', length: 500, nullable: true })
  xmlPayloadUrl?: string | null;

  /** S3: buyer-facing PDF. */
  @Column({ name: 'txi_pdf_url', type: 'varchar', length: 500, nullable: true })
  pdfUrl?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
