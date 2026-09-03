import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmTenantTypeormEntity } from '../infrastructure/typeorm/acm-tenant.typeorm-entity';

/**
 * REQ-260903 — 테넌트 일반 설정(타임존). 행 없거나 조회 실패 시
 * 'Asia/Seoul' fail-open (서비스 국가 한국 기본).
 */
export const DEFAULT_TIMEZONE = 'Asia/Seoul';

@Injectable()
export class TenantSettingsService {
  private readonly log = new Logger(TenantSettingsService.name);

  constructor(
    @InjectRepository(AcmTenantTypeormEntity, ACM_DS)
    private readonly tenants: Repository<AcmTenantTypeormEntity>,
  ) {}

  async getTimezone(entId: string): Promise<string> {
    try {
      const row = await this.tenants.findOne({ where: { entId } });
      return row?.timezone?.trim() || DEFAULT_TIMEZONE;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`getTimezone failed ent=${entId} err=${msg} — fail-open`);
      return DEFAULT_TIMEZONE;
    }
  }

  async setTimezone(entId: string, timezone: string): Promise<{ timezone: string }> {
    const tz = timezone.trim();
    // IANA 유효성 — 미지원 TZ면 Intl이 throw
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
    } catch {
      throw new UnprocessableEntityException('INVALID_TIMEZONE');
    }
    const row = await this.tenants.findOne({ where: { entId } });
    if (!row) {
      throw new UnprocessableEntityException('TENANT_NOT_FOUND');
    }
    row.timezone = tz;
    await this.tenants.save(row);
    this.log.log(`timezone updated ent=${entId} tz=${tz}`);
    return { timezone: tz };
  }
}
