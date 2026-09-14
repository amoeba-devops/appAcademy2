import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
import { SiteTagProbe } from '../../acm-common/ga4/site-tag-probe';
import {
  Ga4ConfigTypeormEntity,
  GA4_SITES,
  type Ga4Metric,
  type Ga4Site,
  type Ga4SiteEntry,
  type Ga4SiteLevel,
  type Ga4SiteStatus,
} from '../infrastructure/typeorm/ga4-config.typeorm-entity';

/**
 * PLN-260912 — GA4 방문자 동기화 테넌트 설정 (kakao-config 패턴).
 * 서비스계정 키는 응답에 saEmail + saKeyIsSet 만 노출, 미입력 저장 시 유지.
 */
export interface Ga4ConfigView {
  propertyId: string | null;
  streamMap: Record<string, string>;
  /** PLN-260914C — 사이트별 연동 정보 (항상 3사이트 키 존재) */
  sites: Record<Ga4Site, Required<Ga4SiteEntry>>;
  siteStatus: Record<string, Ga4SiteStatus> | null;
  siteCheckedAt: string | null;
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
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly probe: SiteTagProbe,
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
      /** PLN-260914C — site → {url, measurementId, streamId}; streamMap 을 재생성한다 */
      siteMap?: Record<string, Ga4SiteEntry>;
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
    if (dto.siteMap !== undefined) {
      const clean: Record<string, Ga4SiteEntry> = {};
      const streams: Record<string, string> = {};
      for (const site of GA4_SITES) {
        const e = dto.siteMap[site] ?? {};
        const url = (e.url ?? '').toString().trim();
        if (url && !/^https?:\/\/\S+$/i.test(url))
          throw new Error(`GA4_SITE_URL_INVALID ${site}`);
        const mid = (e.measurementId ?? '').toString().trim().toUpperCase();
        if (mid && !/^G-[A-Z0-9]{6,12}$/.test(mid))
          throw new Error(`GA4_SITE_MEASUREMENT_ID_INVALID ${site}`);
        const streamId = (e.streamId ?? '').toString().replace(/[^0-9]/g, '');
        clean[site] = { url, measurementId: mid, streamId };
        if (streamId) streams[site] = streamId;
      }
      row.siteMap = clean;
      row.streamMap = streams;
    } else if (dto.streamMap !== undefined) {
      const clean: Record<string, string> = {};
      const siteMap: Record<string, Ga4SiteEntry> = { ...(row.siteMap ?? {}) };
      for (const site of GA4_SITES) {
        const v = (dto.streamMap[site] ?? '').toString().replace(/[^0-9]/g, '');
        if (v) clean[site] = v;
        siteMap[site] = { ...(siteMap[site] ?? {}), streamId: v };
      }
      row.streamMap = clean;
      row.siteMap = siteMap;
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

  /**
   * PLN-260914C — 사이트별 연동 상태 점검.
   * ① 태그 설치(공개 HTML 에 측정 ID 검출) ② GA4 수신(최근 7일 스트림별 행·최근일) ③ ACM 반영(site_visit).
   * 결과는 gac_site_status 에 저장한다. 설정 행이 없으면 GA4_CONFIG_NOT_SET.
   */
  async checkSiteStatus(
    entId: string,
  ): Promise<{ checkedAt: string; sites: Record<Ga4Site, Ga4SiteStatus> }> {
    const row = await this.repo.findOne({ where: { entId } });
    if (!row) throw new Error('GA4_CONFIG_NOT_SET');
    const sites = this.sitesOf(row);
    const cfg = this.toSyncConfig(row);
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 86400000);
    const startIso = start.toISOString().slice(0, 10);

    // ② GA4 report — one call for all streams
    const ga4ByStream: Record<
      string,
      { rows: number; lastDate: string | null; visitors7d: number }
    > = {};
    let ga4Error: string | null = null;
    if (cfg) {
      try {
        const rows = await this.ga4.runReport(cfg.key, {
          propertyId: cfg.propertyId,
          startDate: startIso,
          endDate: end.toISOString().slice(0, 10),
          metrics: [cfg.metric],
        });
        for (const r of rows) {
          const b = (ga4ByStream[r.streamId] ??= {
            rows: 0,
            lastDate: null,
            visitors7d: 0,
          });
          b.rows += 1;
          b.visitors7d += Math.round(r.metrics[cfg.metric] ?? 0);
          if (!b.lastDate || r.date > b.lastDate) b.lastDate = r.date;
        }
      } catch (e: unknown) {
        ga4Error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      }
    } else {
      ga4Error = 'GA4_CONFIG_NOT_SET';
    }

    // ③ ACM site_visit
    const acmRows = await this.ds.query<
      { site: string; last_date: string | null; v7: string }[]
    >(
      `SELECT svt_site AS site,
              MAX(svt_date)::text AS last_date,
              COALESCE(SUM(svt_visitors) FILTER (WHERE svt_date >= $2::date), 0)::text AS v7
         FROM amb_acm_dsh_site_visit
        WHERE ent_id = $1
        GROUP BY svt_site`,
      [entId, startIso],
    );
    const acmBySite: Record<
      string,
      { lastDate: string | null; visitors7d: number }
    > = {};
    for (const r of acmRows)
      acmBySite[r.site] = { lastDate: r.last_date, visitors7d: Number(r.v7) };

    // ① tag probe — in parallel
    const probes = await Promise.all(
      GA4_SITES.map((site) => {
        const s = sites[site];
        return s.url && s.measurementId
          ? this.probe.probeTag(s.url, s.measurementId)
          : Promise.resolve(null);
      }),
    );

    const checkedAt = new Date();
    const result = {} as Record<Ga4Site, Ga4SiteStatus>;
    GA4_SITES.forEach((site, i) => {
      const s = sites[site];
      const tag = probes[i] ?? { installed: null, foundIds: [], error: null };
      const ga4 = s.streamId
        ? (ga4ByStream[s.streamId] ?? {
            rows: 0,
            lastDate: null,
            visitors7d: 0,
          })
        : { rows: 0, lastDate: null, visitors7d: 0 };
      const acm = acmBySite[site] ?? { lastDate: null, visitors7d: 0 };
      let level: Ga4SiteLevel;
      if (!s.streamId) level = 'NOT_CONFIGURED';
      else if (ga4.rows > 0) level = 'OK';
      else if (tag.installed === false) level = 'TAG_MISSING';
      else if (tag.installed === true) level = 'NO_DATA';
      else level = 'UNKNOWN';
      result[site] = {
        level,
        tag,
        ga4: { ...ga4, error: ga4Error },
        acm,
        checkedAt: checkedAt.toISOString(),
      };
    });

    await this.repo.update(
      { entId },
      { siteStatus: result, siteCheckedAt: checkedAt },
    );
    this.log.log(
      `ga4 site-status ent=${entId} ${GA4_SITES.map((s) => `${s}=${result[s].level}`).join(' ')}`,
    );
    return { checkedAt: checkedAt.toISOString(), sites: result };
  }

  /** 3사이트 키가 항상 존재하는 정규화 뷰 (siteMap 우선, 없으면 legacy streamMap). */
  private sitesOf(
    row: Ga4ConfigTypeormEntity | null,
  ): Record<Ga4Site, Required<Ga4SiteEntry>> {
    const out = {} as Record<Ga4Site, Required<Ga4SiteEntry>>;
    for (const site of GA4_SITES) {
      const e = row?.siteMap?.[site] ?? {};
      out[site] = {
        url: e.url ?? '',
        measurementId: e.measurementId ?? '',
        streamId: e.streamId ?? row?.streamMap?.[site] ?? '',
      };
    }
    return out;
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
      sites: this.sitesOf(row),
      siteStatus: row?.siteStatus ?? null,
      siteCheckedAt: row?.siteCheckedAt
        ? row.siteCheckedAt.toISOString()
        : null,
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
