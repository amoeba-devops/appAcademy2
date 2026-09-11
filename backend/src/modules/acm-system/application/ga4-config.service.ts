import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import {
  packEncrypted,
  unpackEncrypted,
} from '../../acm-auth/infrastructure/ama-secret.codec';
import {
  Ga4DataClient,
  parseServiceAccountKey,
  type ServiceAccountKey,
} from '../../acm-common/ga4/ga4-data.client';
import {
  Ga4ConfigTypeormEntity,
  GA4_SITES,
  type Ga4Metric,
} from '../infrastructure/typeorm/ga4-config.typeorm-entity';

/**
 * PLN-260912 — GA4 방문자 동기화 테넌트 설정 (kakao-config 패턴).
 * 서비스계정 키는 응답에 saEmail + saKeyIsSet 만 노출, 미입력 저장 시 유지.
 */
export interface Ga4ConfigView {
  propertyId: string | null;
  streamMap: Record<string, string>;
  saEmail: string | null;
  saKeyIsSet: boolean;
  metric: Ga4Metric;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  updatedAt: string | null;
}

export interface Ga4SyncConfig {
  propertyId: string;
  /** streamId → site code */
  streamToSite: Record<string, string>;
  metric: Ga4Metric;
  key: ServiceAccountKey;
}

@Injectable()
export class Ga4ConfigService {
  private readonly log = new Logger(Ga4ConfigService.name);

  constructor(
    @InjectRepository(Ga4ConfigTypeormEntity, ACM_DS)
    private readonly repo: Repository<Ga4ConfigTypeormEntity>,
    private readonly aes: AesGcmService,
    private readonly ga4: Ga4DataClient,
  ) {}

  async findByEntId(entId: string): Promise<Ga4ConfigView> {
    const row = await this.repo.findOne({ where: { entId } });
    return this.toView(row);
  }

  async upsertByEntId(
    entId: string,
    dto: {
      propertyId?: string;
      streamMap?: Record<string, string>;
      /** undefined = 유지, '' = 삭제, JSON 문자열 = 교체 */
      saKeyJson?: string;
      metric?: Ga4Metric;
      isActive?: boolean;
    },
  ): Promise<Ga4ConfigView> {
    let row = await this.repo.findOne({ where: { entId } });
    if (!row)
      row = this.repo.create({
        entId,
        streamMap: {},
        metric: 'activeUsers',
        isActive: true,
      });
    if (dto.propertyId !== undefined) {
      row.propertyId = dto.propertyId.replace(/[^0-9]/g, '') || null;
    }
    if (dto.streamMap !== undefined) {
      const clean: Record<string, string> = {};
      for (const site of GA4_SITES) {
        const v = (dto.streamMap[site] ?? '').toString().replace(/[^0-9]/g, '');
        if (v) clean[site] = v;
      }
      row.streamMap = clean;
    }
    if (dto.metric !== undefined) row.metric = dto.metric;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.saKeyJson !== undefined) {
      if (dto.saKeyJson) {
        const key = parseServiceAccountKey(dto.saKeyJson); // throws on invalid
        row.saKeyEnc = packEncrypted(this.aes.encrypt(dto.saKeyJson));
        row.saEmail = key.client_email;
      } else {
        row.saKeyEnc = null;
        row.saEmail = null;
      }
    }
    const saved = await this.repo.save(row);
    this.log.log(
      `ga4-config upsert ent=${entId} active=${saved.isActive} keyChanged=${dto.saKeyJson !== undefined}`,
    );
    return this.toView(saved);
  }

  /** 동기화용 설정 — 활성·필수값 완비 아니면 null. */
  async getSyncConfig(entId: string): Promise<Ga4SyncConfig | null> {
    const row = await this.repo.findOne({ where: { entId } });
    if (!row || !row.isActive) return null;
    return this.toSyncConfig(row);
  }

  /** 설정만 완비되면(활성 여부 무관) 반환 — 연결 테스트용. */
  async getSyncConfigForTest(entId: string): Promise<Ga4SyncConfig | null> {
    const row = await this.repo.findOne({ where: { entId } });
    if (!row) return null;
    return this.toSyncConfig(row);
  }

  /** 활성 설정을 가진 테넌트 목록 (야간 잡). */
  async listActiveEntIds(): Promise<string[]> {
    const rows = await this.repo.find({ where: { isActive: true } });
    return rows
      .filter(
        (r) =>
          r.propertyId &&
          r.saKeyEnc?.length &&
          Object.keys(r.streamMap ?? {}).length,
      )
      .map((r) => r.entId);
  }

  /**
   * 연결 테스트 — 최근 7일 리포트 1회 호출. 권한/속성 ID/키 검증.
   * 반환: 스트림별 행 수 (매핑 확인용).
   */
  async testConnection(
    entId: string,
  ): Promise<{ ok: true; rows: number; streams: string[] }> {
    const cfg = await this.getSyncConfigForTest(entId);
    if (!cfg) throw new Error('GA4_CONFIG_NOT_SET');
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 86400000);
    const rows = await this.ga4.runReport(cfg.key, {
      propertyId: cfg.propertyId,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      metrics: [cfg.metric],
    });
    const streams = [...new Set(rows.map((r) => r.streamId))];
    return { ok: true, rows: rows.length, streams };
  }

  async recordSyncResult(
    entId: string,
    status: 'SUCCESS' | 'FAILED',
    error?: string,
  ): Promise<void> {
    await this.repo.update(
      { entId },
      {
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: error?.slice(0, 2000) ?? null,
      },
    );
  }

  private toSyncConfig(row: Ga4ConfigTypeormEntity): Ga4SyncConfig | null {
    if (!row.propertyId || !row.saKeyEnc?.length) return null;
    const streamToSite: Record<string, string> = {};
    for (const [site, streamId] of Object.entries(row.streamMap ?? {})) {
      if (streamId) streamToSite[String(streamId)] = site;
    }
    if (!Object.keys(streamToSite).length) return null;
    const json = this.aes.decrypt(unpackEncrypted(row.saKeyEnc));
    return {
      propertyId: row.propertyId,
      streamToSite,
      metric: row.metric ?? 'activeUsers',
      key: parseServiceAccountKey(json),
    };
  }

  private toView(row: Ga4ConfigTypeormEntity | null): Ga4ConfigView {
    return {
      propertyId: row?.propertyId ?? null,
      streamMap: row?.streamMap ?? {},
      saEmail: row?.saEmail ?? null,
      saKeyIsSet: !!row?.saKeyEnc?.length,
      metric: row?.metric ?? 'activeUsers',
      isActive: row?.isActive ?? true,
      lastSyncAt: row?.lastSyncAt ? row.lastSyncAt.toISOString() : null,
      lastSyncStatus: row?.lastSyncStatus ?? null,
      lastSyncError: row?.lastSyncError ?? null,
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    };
  }
}
