import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { KakaoConfigService, KakaoSendConfig } from './kakao-config.service';

/**
 * REQ-260903E — Solapi 카카오 알림톡 발송 클라이언트 (ACM 직접 구현).
 *
 * - POST https://api.solapi.com/messages/v4/send-many/detail
 * - Authorization: HMAC-SHA256 apiKey=…, date=…, salt=…, signature=…
 *   (signature = HMAC-SHA256(apiSecret, date + salt))
 * - message: { to, from?, type: 'ATA',
 *     kakaoOptions: { pfId, templateId, variables: {"#{학생명}": …}, disableSms } }
 * - 템플릿 변수 계약(고정): #{학원명} #{학생명} #{수업명} #{일시}
 */
export interface AlimtalkVariables {
  [key: `#{${string}}`]: string;
}

const SOLAPI_URL = 'https://api.solapi.com/messages/v4/send-many/detail';
const TIMEOUT_MS = 10_000;

@Injectable()
export class SolapiAlimtalkService {
  private readonly log = new Logger(SolapiAlimtalkService.name);

  constructor(private readonly configSvc: KakaoConfigService) {}

  async isConfigured(entId: string): Promise<boolean> {
    return (await this.configSvc.getSendConfig(entId)) !== null;
  }

  /** 알림톡 1건 발송. 실패 시 사유 메시지를 담아 throw. */
  async send(
    entId: string,
    to: string,
    variables: Record<string, string>,
  ): Promise<void> {
    const cfg = await this.configSvc.getSendConfig(entId);
    if (!cfg) throw new Error('KAKAO_CONFIG_NOT_SET');
    await this.dispatch(cfg, to, variables);
  }

  /** 설정 페이지 테스트 발송 — 샘플 변수로 실발송. */
  async sendTest(entId: string, to: string): Promise<void> {
    const cfg = await this.configSvc.getSendConfig(entId);
    if (!cfg) throw new Error('KAKAO_CONFIG_NOT_SET');
    await this.dispatch(cfg, to, {
      '#{학원명}': 'ACM 테스트',
      '#{학생명}': '홍길동',
      '#{수업명}': '테스트 수업',
      '#{일시}': new Date().toISOString().slice(0, 10),
    });
    this.log.log(`alimtalk test sent ent=${entId} to=${to}`);
  }

  private async dispatch(
    cfg: KakaoSendConfig,
    to: string,
    variables: Record<string, string>,
  ): Promise<void> {
    const message: Record<string, unknown> = {
      to: to.replace(/[^0-9]/g, ''),
      type: 'ATA',
      kakaoOptions: {
        pfId: cfg.pfId,
        templateId: cfg.templateId,
        variables,
        disableSms: !cfg.smsFallback,
      },
      ...(cfg.senderPhone ? { from: cfg.senderPhone } : {}),
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(SOLAPI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader(cfg.apiKey, cfg.apiSecret),
        },
        body: JSON.stringify({ messages: [message] }),
        signal: ctrl.signal,
      });
      const body = (await res.json().catch(() => ({}))) as {
        failedMessageList?: Array<{
          statusCode?: string;
          statusMessage?: string;
        }>;
        errorCode?: string;
        errorMessage?: string;
      };
      if (!res.ok) {
        throw new Error(
          `SOLAPI_${res.status}: ${body.errorCode ?? ''} ${body.errorMessage ?? ''}`.trim(),
        );
      }
      const failed = body.failedMessageList ?? [];
      if (failed.length > 0) {
        const f = failed[0];
        throw new Error(
          `SOLAPI_REJECTED: ${f.statusCode ?? ''} ${f.statusMessage ?? ''}`.trim(),
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }

  private authHeader(apiKey: string, apiSecret: string): string {
    const date = new Date().toISOString();
    const salt = randomBytes(16).toString('hex');
    const signature = createHmac('sha256', apiSecret)
      .update(date + salt)
      .digest('hex');
    return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
  }
}
