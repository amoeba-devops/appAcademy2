import { Injectable, Logger } from '@nestjs/common';
import type {
  INtsEtaxProvider,
  NtsSubmitRequest,
  NtsSubmitResponse,
} from '../../../domain/repositories/nts-etax-provider.interface.js';

/**
 * NTS eTax Adapter — 국세청 홈택스 세금계산서 발행 API 연동
 *
 * NOTE: 실제 국세청 API 연동은 공동인증서(HSM/KMS) + XML 전자서명 구현 필요.
 * 현재는 Stub 구현체로 SUBMITTED 상태 반환. 운영 시 실제 API로 교체.
 */
@Injectable()
export class NtsEtaxAdapter implements INtsEtaxProvider {
  private readonly logger = new Logger(NtsEtaxAdapter.name);

  async submit(req: NtsSubmitRequest): Promise<NtsSubmitResponse> {
    this.logger.log(
      `[STUB] NTS eTax submit: invoiceNo=${req.invoiceNo}, total=${req.totalAmount}`,
    );

    // TODO: Replace with real NTS API integration:
    // 1. Generate XML per NTS standard schema
    // 2. Sign XML with certificate from HSM/KMS
    // 3. POST to NTS eTax API
    // 4. Parse response for ntsIssueNo

    // Stub: simulate successful submission
    return {
      success: true,
      ntsIssueNo: `NTS-${Date.now()}`,
      approvedAt: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
    };
  }
}
