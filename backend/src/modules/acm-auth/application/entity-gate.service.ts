import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmTenantTypeormEntity } from '../../acm-system/infrastructure/typeorm/acm-tenant.typeorm-entity';
import { AmaConfigTypeormEntity } from '../infrastructure/typeorm/ama-config.typeorm-entity';

/**
 * REQ-260609 FR-A — TPI-only entity gate.
 *
 * `tpi-acm` is a single-tenant app: only the TPI entity (code `VN3040`)
 * may sign in. On each AMA SSO exchange we resolve an active PostgreSQL
 * AMA config by the token's entityId (UUID). When a tenant entity code or
 * token entity code is present, it must be in the allowed whitelist (env
 * `AMA_ALLOWED_ENTITY_CODES`, default `VN3040`).
 *
 * Fail-closed: unknown AMA config / not-whitelisted →
 * 403 ENTITY_NOT_ALLOWED. Runs before subscription + membership checks so
 * a non-TPI entity never reaches the heavier live calls.
 */
@Injectable()
export class EntityGateService {
  private readonly logger = new Logger(EntityGateService.name);
  private readonly allowedCodes: string[];

  constructor(
    @InjectRepository(AmaConfigTypeormEntity, ACM_DS)
    private readonly amaConfigRepo: Repository<AmaConfigTypeormEntity>,
    @InjectRepository(AcmTenantTypeormEntity, ACM_DS)
    private readonly tenantRepo: Repository<AcmTenantTypeormEntity>,
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
    const config = await this.amaConfigRepo.findOne({
      where: { amaEntityId: entityId, isActive: true },
    });
    if (!config) {
      this.deny(entityId, 'active AMA config not found');
    }

    const tenant = await this.tenantRepo.findOne({
      where: { entId: config.entId },
    });
    const storedCode = tenant?.amaEntityCode?.trim().toUpperCase() ?? null;
    const claimCode = tokenEntityCode?.trim().toUpperCase() ?? null;
    const codeToCheck = storedCode ?? claimCode;

    if (codeToCheck && !this.allowedCodes.includes(codeToCheck)) {
      this.deny(entityId, `code=${codeToCheck} not in whitelist`);
    }
    if (storedCode && claimCode && claimCode !== storedCode) {
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
