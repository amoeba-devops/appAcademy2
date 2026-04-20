import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PayOrderEntity } from './pay-order.entity';
import { AcademyEntity } from './academy.entity';

@Entity('tac_pay_tax_invoices')
export class PayTaxInvoiceEntity {
  @PrimaryGeneratedColumn({ name: 'txi_id', type: 'bigint', unsigned: true })
  txiId: number;

  @Column({ name: 'pod_id', type: 'bigint', unsigned: true })
  podId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'txi_invoice_no', type: 'varchar', length: 40 })
  txiInvoiceNo: string;

  @Column({ name: 'txi_nts_issue_no', type: 'varchar', length: 24, nullable: true })
  txiNtsIssueNo: string | null;

  @Column({ name: 'txi_supplier_biz_no', type: 'varchar', length: 13 })
  txiSupplierBizNo: string;

  @Column({ name: 'txi_buyer_biz_no', type: 'varchar', length: 13, nullable: true })
  txiBuyerBizNo: string | null;

  @Column({ name: 'txi_buyer_type', type: 'varchar', length: 20 })
  txiBuyerType: string;

  @Column({ name: 'txi_supply_amount', type: 'decimal', precision: 12, scale: 2 })
  txiSupplyAmount: string;

  @Column({ name: 'txi_tax_amount', type: 'decimal', precision: 12, scale: 2 })
  txiTaxAmount: string;

  @Column({ name: 'txi_total_amount', type: 'decimal', precision: 12, scale: 2 })
  txiTotalAmount: string;

  @Column({ name: 'txi_issue_date', type: 'date' })
  txiIssueDate: string;

  @Column({ name: 'txi_status', type: 'varchar', length: 20, default: 'DRAFT' })
  txiStatus: string;

  @Column({ name: 'txi_nts_submitted_at', type: 'datetime', nullable: true })
  txiNtsSubmittedAt: Date | null;

  @Column({ name: 'txi_nts_approved_at', type: 'datetime', nullable: true })
  txiNtsApprovedAt: Date | null;

  @Column({ name: 'txi_nts_error_code', type: 'varchar', length: 30, nullable: true })
  txiNtsErrorCode: string | null;

  @Column({ name: 'txi_nts_error_message', type: 'varchar', length: 500, nullable: true })
  txiNtsErrorMessage: string | null;

  @Column({ name: 'txi_xml_payload_url', type: 'varchar', length: 500, nullable: true })
  txiXmlPayloadUrl: string | null;

  @Column({ name: 'txi_pdf_url', type: 'varchar', length: 500, nullable: true })
  txiPdfUrl: string | null;

  @CreateDateColumn({ name: 'txi_created_at' })
  txiCreatedAt: Date;

  @UpdateDateColumn({ name: 'txi_updated_at' })
  txiUpdatedAt: Date;

  @ManyToOne(() => PayOrderEntity, (o) => o.taxInvoices)
  @JoinColumn({ name: 'pod_id' })
  order: PayOrderEntity;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;
}
