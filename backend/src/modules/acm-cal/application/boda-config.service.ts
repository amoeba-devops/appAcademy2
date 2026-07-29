import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  decryptBodaCredential,
  deriveBodaKey,
  encryptBodaCredential,
} from '../../../infrastructure/external/bodaedu/crypto/boda-credential.crypto';
import { BodaConfigTypeormEntity } from '../infrastructure/typeorm/boda-config.typeorm-entity';
import {
  BodaConfigResponseDto,
  UpdateBodaConfigDto,
} from './dto/boda-config.dto';
import type { BodaServerAuth } from '../../../infrastructure/external/bodaedu/interfaces/bodaedu-server-api.interface';

/**
 * REQ-260526 v2 FR-BODA-CFG — 테넌트 BODA 연동 설정 CRUD.
 *
 * 책임 분리:
 *   - 본 서비스 : 평문 ↔ AES-GCM BYTEA 변환 + 테넌트 단건 read/write
 *   - 호출자    : 어드민 권한 검증 (controller @Roles + OwnEntityGuard)
 *   - 별도 모듈 : BodaeduServerHttpClient 가 실제 설정값 (`getDecryptedAuthKey`)
 *                 을 통해 SERVER API 호출. 그 외 누구도 비밀 평문에 접근하지 못함.
 *
 * `BODA_CRYPTO_KEY` env 가 없으면 service 가 부팅 시점 fail-fast. 운영자가
 * 명시적으로 비밀 등록을 시도하면 503 응답.
 */
@Injectable()
export class BodaConfigService {
  private readonly logger = new Logger(BodaConfigService.name);
  private readonly cryptoKey: Buffer | null;

  constructor(
    @InjectRepository(BodaConfigTypeormEntity, ACM_DS)
    private readonly repo: Repository<BodaConfigTypeormEntity>,
    config: ConfigService,
  ) {
    const envKey = config.get<string>('BODA_CRYPTO_KEY');
    if (envKey) {
      try {
        this.cryptoKey = deriveBodaKey(envKey);
      } catch (e) {
        this.logger.error(
          `BODA_CRYPTO_KEY invalid — secret writes will be refused. ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
        this.cryptoKey = null;
      }
    } else {
      this.logger.warn(
        'BODA_CRYPTO_KEY not set — secret writes will be refused (NFR-3). ' +
          'Read-side will still return is_set=false placeholders.',
      );
      this.cryptoKey = null;
    }
  }

  // -------------------------------------------------------------------------

  async findByEntId(entId: string): Promise<BodaConfigResponseDto | null> {
    const row = await this.repo.findOne({ where: { entId } });
    return row ? this.toResponse(row) : null;
  }

  /**
   * Upsert (1 row per ent_id). Secrets are encrypted if provided; null/undefined
   * means "leave existing value alone" (not "wipe").
   */
  async upsertByEntId(
    entId: string,
    dto: UpdateBodaConfigDto,
  ): Promise<BodaConfigResponseDto> {
    const existing = await this.repo.findOne({ where: { entId } });

    // Encrypt secrets if requested.
    const authKeyEnc =
      dto.authKey !== undefined
        ? this.encryptOr503('authKey', dto.authKey)
        : (existing?.authKeyEnc ?? null);
    const eventSecretEnc =
      dto.eventSecret !== undefined
        ? this.encryptOr503('eventSecret', dto.eventSecret)
        : (existing?.eventSecretEnc ?? null);

    if (!existing) {
      // First creation requires the public URL fields + companyCode/Id/roomCode.
      // We allow undefined → fall back to empty string and let the caller's
      // 4xx flow surface this via subsequent GET (or follow-up PUT with full
      // payload).  Strict required validation is intentionally relegated to
      // the controller's DTO body shape.
      const created = this.repo.create({
        entId,
        bodaWebUrl: dto.bodaWebUrl ?? '',
        svrUrl: dto.svrUrl ?? '',
        webrtcUrl: dto.webrtcUrl ?? '',
        companyCode: dto.companyCode ?? '',
        companyId: dto.companyId ?? '',
        defaultRoomCode: dto.defaultRoomCode ?? '',
        groupRoomCode: dto.groupRoomCode ?? null,
        authKeyEnc,
        eventSecretEnc,
        webhookAllowCidrs: dto.webhookAllowCidrs ?? null,
        graceBeforeMin: dto.graceBeforeMin ?? 10,
        graceAfterMin: dto.graceAfterMin ?? 15,
        reconcileDelayMin: dto.reconcileDelayMin ?? 10,
        isActive: dto.isActive ?? true,
      });
      const saved = await this.repo.save(created);
      this.logger.log(`boda config created entId=${entId} id=${saved.id}`);
      return this.toResponse(saved);
    }

    // Patch fields one-by-one; undefined means "no change".
    if (dto.bodaWebUrl !== undefined) existing.bodaWebUrl = dto.bodaWebUrl;
    if (dto.svrUrl !== undefined) existing.svrUrl = dto.svrUrl;
    if (dto.webrtcUrl !== undefined) existing.webrtcUrl = dto.webrtcUrl;
    if (dto.companyCode !== undefined) existing.companyCode = dto.companyCode;
    if (dto.companyId !== undefined) existing.companyId = dto.companyId;
    if (dto.defaultRoomCode !== undefined)
      existing.defaultRoomCode = dto.defaultRoomCode;
    if (dto.groupRoomCode !== undefined)
      existing.groupRoomCode = dto.groupRoomCode;
    existing.authKeyEnc = authKeyEnc;
    existing.eventSecretEnc = eventSecretEnc;
    if (dto.webhookAllowCidrs !== undefined)
      existing.webhookAllowCidrs = dto.webhookAllowCidrs;
    if (dto.graceBeforeMin !== undefined)
      existing.graceBeforeMin = dto.graceBeforeMin;
    if (dto.graceAfterMin !== undefined)
      existing.graceAfterMin = dto.graceAfterMin;
    if (dto.reconcileDelayMin !== undefined)
      existing.reconcileDelayMin = dto.reconcileDelayMin;
    if (dto.isActive !== undefined) existing.isActive = dto.isActive;

    const saved = await this.repo.save(existing);
    this.logger.log(
      `boda config updated entId=${entId} id=${saved.id} ` +
        `authKey_changed=${dto.authKey !== undefined} ` +
        `eventSecret_changed=${dto.eventSecret !== undefined}`,
    );
    return this.toResponse(saved);
  }

  // -------------------------------------------------------------------------
  // Internal — used by other services that need the plaintext (BodaeduServer
  // HTTP client / Webhook handler). MUST NOT be exposed via HTTP.
  // -------------------------------------------------------------------------

  async getDecryptedAuthKey(entId: string): Promise<string | null> {
    if (!this.cryptoKey) return null;
    const row = await this.repo.findOne({ where: { entId } });
    if (!row?.authKeyEnc) return null;
    return decryptBodaCredential(row.authKeyEnc, this.cryptoKey);
  }

  async getDecryptedEventSecret(entId: string): Promise<string | null> {
    if (!this.cryptoKey) return null;
    const row = await this.repo.findOne({ where: { entId } });
    if (!row?.eventSecretEnc) return null;
    return decryptBodaCredential(row.eventSecretEnc, this.cryptoKey);
  }

  /**
   * SERVER API 호출용 테넌트 인증 조립 (env 미사용 요구 — 설정 → BODA 연동
   * 화면 입력값 사용). `svrUrl` + `Base64(companyCode:authKey)` 를 반환한다.
   * 필수 값(svrUrl/companyCode/authKey) 중 하나라도 없거나 crypto key 미설정
   * 이면 null → 호출자가 env fallback / BodaeduUnavailable 로 처리.
   */
  async getServerApiAuth(entId: string): Promise<BodaServerAuth | null> {
    if (!this.cryptoKey) return null;
    const row = await this.repo.findOne({ where: { entId } });
    if (!row?.svrUrl || !row.companyCode || !row.authKeyEnc?.length)
      return null;
    const authKey = decryptBodaCredential(row.authKeyEnc, this.cryptoKey);
    const basicAuth = Buffer.from(`${row.companyCode}:${authKey}`).toString(
      'base64',
    );
    return { baseUrl: row.svrUrl, basicAuth };
  }

  // -------------------------------------------------------------------------

  private encryptOr503(field: string, plain: string): Buffer {
    if (!this.cryptoKey) {
      throw new HttpException(
        {
          code: 'BODA_CRYPTO_KEY_NOT_SET',
          message: `Cannot store ${field}: BODA_CRYPTO_KEY env is not configured`,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return encryptBodaCredential(plain, this.cryptoKey);
  }

  private toResponse(row: BodaConfigTypeormEntity): BodaConfigResponseDto {
    return {
      id: row.id,
      entId: row.entId,
      bodaWebUrl: row.bodaWebUrl,
      svrUrl: row.svrUrl,
      webrtcUrl: row.webrtcUrl,
      companyCode: row.companyCode,
      companyId: row.companyId,
      defaultRoomCode: row.defaultRoomCode,
      groupRoomCode: row.groupRoomCode ?? null,
      authKeyIsSet: !!row.authKeyEnc?.length,
      eventSecretIsSet: !!row.eventSecretEnc?.length,
      webhookAllowCidrs: row.webhookAllowCidrs ?? null,
      graceBeforeMin: row.graceBeforeMin,
      graceAfterMin: row.graceAfterMin,
      reconcileDelayMin: row.reconcileDelayMin,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
