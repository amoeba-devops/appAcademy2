import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import {
  packEncrypted,
  unpackEncrypted,
} from '../../acm-auth/infrastructure/ama-secret.codec';
import { KakaoConfigTypeormEntity } from '../infrastructure/typeorm/kakao-config.typeorm-entity';

/**
 * REQ-260903E — 카카오 알림톡(Solapi) 테넌트 설정 (mail-config 패턴).
 * API Secret 은 응답에 apiSecretIsSet 만 노출, 미입력 저장 시 유지.
 */
export interface KakaoConfigView {
  apiKey: string | null;
  apiSecretIsSet: boolean;
  pfId: string | null;
  templateId: string | null;
  senderPhone: string | null;
  smsFallback: boolean;
  isActive: boolean;
  updatedAt: string | null;
}

export interface KakaoSendConfig {
  apiKey: string;
  apiSecret: string;
  pfId: string;
  templateId: string;
  senderPhone: string | null;
  smsFallback: boolean;
}

@Injectable()
export class KakaoConfigService {
  private readonly log = new Logger(KakaoConfigService.name);

  constructor(
    @InjectRepository(KakaoConfigTypeormEntity, ACM_DS)
    private readonly repo: Repository<KakaoConfigTypeormEntity>,
    private readonly aes: AesGcmService,
  ) {}

  async findByEntId(entId: string): Promise<KakaoConfigView> {
    const row = await this.repo.findOne({ where: { entId } });
    return this.toView(row);
  }

  async upsertByEntId(
    entId: string,
    dto: {
      apiKey?: string;
      apiSecret?: string;
      pfId?: string;
      templateId?: string;
      senderPhone?: string;
      smsFallback?: boolean;
      isActive?: boolean;
    },
  ): Promise<KakaoConfigView> {
    let row = await this.repo.findOne({ where: { entId } });
    if (!row) row = this.repo.create({ entId });
    if (dto.apiKey !== undefined) row.apiKey = dto.apiKey.trim() || null;
    if (dto.pfId !== undefined) row.pfId = dto.pfId.trim() || null;
    if (dto.templateId !== undefined) {
      row.templateId = dto.templateId.trim() || null;
    }
    if (dto.senderPhone !== undefined) {
      row.senderPhone = dto.senderPhone.replace(/[^0-9]/g, '') || null;
    }
    if (dto.smsFallback !== undefined) row.smsFallback = dto.smsFallback;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    // apiSecret: undefined = 유지, '' = 삭제, 값 = 암호화 교체
    if (dto.apiSecret !== undefined) {
      row.apiSecretEnc = dto.apiSecret
        ? packEncrypted(this.aes.encrypt(dto.apiSecret))
        : null;
    }
    const saved = await this.repo.save(row);
    this.log.log(
      `kakao-config upsert ent=${entId} active=${saved.isActive} secretChanged=${dto.apiSecret !== undefined}`,
    );
    return this.toView(saved);
  }

  /** 발송용 설정 — 활성·필수값 완비 아니면 null. */
  async getSendConfig(entId: string): Promise<KakaoSendConfig | null> {
    const row = await this.repo.findOne({ where: { entId } });
    if (
      !row ||
      !row.isActive ||
      !row.apiKey?.trim() ||
      !row.apiSecretEnc?.length ||
      !row.pfId?.trim() ||
      !row.templateId?.trim()
    ) {
      return null;
    }
    return {
      apiKey: row.apiKey.trim(),
      apiSecret: this.aes.decrypt(unpackEncrypted(row.apiSecretEnc)),
      pfId: row.pfId.trim(),
      templateId: row.templateId.trim(),
      senderPhone: row.senderPhone?.trim() || null,
      smsFallback: row.smsFallback,
    };
  }

  private toView(row: KakaoConfigTypeormEntity | null): KakaoConfigView {
    return {
      apiKey: row?.apiKey ?? null,
      apiSecretIsSet: !!row?.apiSecretEnc?.length,
      pfId: row?.pfId ?? null,
      templateId: row?.templateId ?? null,
      senderPhone: row?.senderPhone ?? null,
      smsFallback: row?.smsFallback ?? false,
      isActive: row?.isActive ?? true,
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    };
  }
}
