/**
 * INtsEtaxProvider — 국세청 eTax API 추상화 인터페이스
 */
export interface NtsSubmitRequest {
  invoiceNo: string;
  supplierBizNo: string;
  buyerBizNo: string | null;
  buyerType: string;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  issueDate: string;
}

export interface NtsSubmitResponse {
  success: boolean;
  ntsIssueNo: string | null;
  approvedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface INtsEtaxProvider {
  submit(req: NtsSubmitRequest): Promise<NtsSubmitResponse>;
}

export const NTS_ETAX_PROVIDER = Symbol('INtsEtaxProvider');
