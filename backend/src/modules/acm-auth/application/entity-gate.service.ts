import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademyEntity } from '../../../infrastructure/database/entities/academy.entity';

/**
 * REQ-260609 FR-A — TPI-only entity gate.
 *
 * `tpi-acm` is a single-tenant app: only the TPI entity (code `VN3040`)
 * may sign in. On each AMA SSO exchange we resolve the academy by the
 * token's entityId (UUID) and assert its stored `acd_ama_entity_code` is
 * in the allowed whitelist (env `AMA_ALLOWED_ENTITY_CODES`, default
 * `VN3040`). If the AMA token also carries a human-readable entity code
 * claim we cross-check it against the stored value (FR-A3).
 *
 * Fail-closed: unknown academy / missing code / not-whitelisted →
 * 403 ENTITY_NOT_ALLOWED. Runs before subscription + membership checks so
 * a non-TPI entity never reaches the heavier live calls.
 */
@Injectable()
export class EntityGateService {
  private readonly logger = new Logger(EntityGateService.name);
  private readonly allowedCodes: string[];

  constructor(
    @InjectRepository(AcademyEntity)
    private readonly academyRepo: Repository<AcademyEntity>,
    config: ConfigService,
  ) {
    const raw = config.get<string>('AMA_ALLOWED_ENTITY_CODES', 'VN3040');
    this.allowedCodes = raw
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
  }

  /**
   * @param entityId AMA tenant UUID (token `entityId` claim).
   * @param tokenEntityCode optional human-readable code claim from the token
   *        (e.g. `entityCode`/`entitySlug`); cross-checked when present.
   * @throws 403 ENTITY_NOT_ALLOWED when the entity is not a whitelisted TPI tenant.
   */
  async ensureAllowed(
    entityId: string,
    tokenEntityCode?: string | null,
  ): Promise<void> {
    const academy = await this.academyRepo.findOne({
      where: { acdAmaTenantId: entityId },
    });

    const storedCode = academy?.acdAmaEntityCode?.trim().toUpperCase() ?? null;

    if (!academy || !storedCode || !this.allowedCodes.includes(storedCode)) {
      this.deny(entityId, `code=${storedCode ?? 'none'} not in whitelist`);
    }

    // FR-A3 — if the token carries an entity code claim, it must match the
    // academy's stored code (defends against a token minted for another entity
    // that somehow shares a tenant row).
    const claimCode = tokenEntityCode?.trim().toUpperCase();
    if (claimCode && claimCode !== storedCode) {
      this.deny(
        entityId,
        `token code=${claimCode} != stored code=${storedCode}`,
      );
    }
  }

  private deny(entityId: string, reason: string): never {
    this.logger.warn(`entity gate denied entId=${entityId} reason=${reason}`);
    throw new HttpException(
      {
        code: 'ENTITY_NOT_ALLOWED',
        message: 'This app is restricted to the TPI entity',
        data: { entityId },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
