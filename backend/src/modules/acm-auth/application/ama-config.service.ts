import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { AmaConfigTypeormEntity } from '../infrastructure/typeorm/ama-config.typeorm-entity';
import { packEncrypted } from '../infrastructure/ama-secret.codec';
import {
  AmaConfigResponseDto,
  UpdateAmaConfigDto,
} from './dto/ama-config.dto';

/**
 * REQ-260609B FR-1/FR-2 — 테넌트 AMA 연동 설정 CRUD.
 *
 * 어드민이 `/admin/config` 에서 (entityId, appCode) 를 조회/갱신한다. 값은
 * 평문(비교용 공개 식별자)이라 비밀 마스킹이 없다. 실제 로그인 허용 판정은
 * {@link AmaConfigGateService} 가 본 테이블을 읽어 수행한다.
 */
@Injectable()
export class AmaConfigService {
  private readonly logger = new Logger(AmaConfigService.name);

  constructor(
    @InjectRepository(AmaConfigTypeormEntity, ACM_DS)
    private readonly repo: Repository<AmaConfigTypeormEntity>,
    private readonly aes: AesGcmService,
  ) {}

  async findByEntId(entId: string): Promise<AmaConfigResponseDto | null> {
    const row = await this.repo.findOne({ where: { entId } });
    return row ? this.toResponse(row) : null;
  }

  /** Upsert (1 row per ent_id). 생략된 필드는 기존값 유지(부분 PUT). */
  async upsertByEntId(
    entId: string,
    dto: UpdateAmaConfigDto,
  ): Promise<AmaConfigResponseDto> {
    const existing = await this.repo.findOne({ where: { entId } });

    if (!existing) {
      // 최초 생성에는 두 값이 모두 필요 (NOT NULL). seed 가 보통 선적재하므로
      // 이 경로는 신규 환경에서만 발생.
      if (!dto.amaEntityId || !dto.appCode) {
        throw new BadRequestException(
          'amaEntityId and appCode are required to create the AMA config',
        );
      }
      const created = this.repo.create({
        entId,
        amaEntityId: dto.amaEntityId,
        appCode: dto.appCode,
        isActive: dto.isActive ?? true,
        customAppSecretEnc:
          dto.customAppSecret !== undefined
            ? packEncrypted(this.aes.encrypt(dto.customAppSecret))
            : null,
        expectedScope: dto.expectedScope ?? null,
        categorySecretEnc:
          dto.categorySecret !== undefined
            ? packEncrypted(this.aes.encrypt(dto.categorySecret))
            : null,
        categorySlug: dto.categorySlug ?? null,
      });
      const saved = await this.repo.save(created);
      this.logger.log(`ama config created entId=${entId} id=${saved.id}`);
      return this.toResponse(saved);
    }

    if (dto.amaEntityId !== undefined) existing.amaEntityId = dto.amaEntityId;
    if (dto.appCode !== undefined) existing.appCode = dto.appCode;
    if (dto.isActive !== undefined) existing.isActive = dto.isActive;
    if (dto.expectedScope !== undefined)
      existing.expectedScope = dto.expectedScope;
    if (dto.categorySlug !== undefined)
      existing.categorySlug = dto.categorySlug;
    // Secret: encrypt only when a new value is sent; omitting keeps existing.
    if (dto.customAppSecret !== undefined) {
      existing.customAppSecretEnc = packEncrypted(
        this.aes.encrypt(dto.customAppSecret),
      );
    }
    if (dto.categorySecret !== undefined) {
      existing.categorySecretEnc = packEncrypted(
        this.aes.encrypt(dto.categorySecret),
      );
    }

    const saved = await this.repo.save(existing);
    this.logger.log(
      `ama config updated entId=${entId} id=${saved.id} active=${saved.isActive} ` +
        `app_secret_changed=${dto.customAppSecret !== undefined} ` +
        `category_secret_changed=${dto.categorySecret !== undefined}`,
    );
    return this.toResponse(saved);
  }

  private toResponse(row: AmaConfigTypeormEntity): AmaConfigResponseDto {
    return {
      id: row.id,
      entId: row.entId,
      amaEntityId: row.amaEntityId,
      appCode: row.appCode,
      isActive: row.isActive,
      customAppSecretIsSet: !!row.customAppSecretEnc?.length,
      expectedScope: row.expectedScope ?? null,
      categorySecretIsSet: !!row.categorySecretEnc?.length,
      categorySlug: row.categorySlug ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
