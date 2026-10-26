import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmTenantTypeormEntity } from '../infrastructure/typeorm/acm-tenant.typeorm-entity';
import { DEFAULT_SESSION_HOURS, MAX_SESSION_HOURS } from '../../acm-common/session/session-client';

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

  /** REQ-260903E — 알림톡 #{학원명} 용. 행 없으면 fail-open '학원'. */
  async getTenantName(entId: string): Promise<string> {
    try {
      const row = await this.tenants.findOne({ where: { entId } });
      return row?.name?.trim() || '학원';
    } catch {
      return '학원';
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

  /** PLN-261027 — 서비스 설정 > 로그인 유지 시간. */
  async getSessionPolicy(entId: string) {
    const [row] = await this.tenants.manager.query<
      { hours: number | null; updatedAt: string | null; updatedBy: string | null; updatedByName: string | null }[]
    >(
      `SELECT t.tnt_session_hours hours, t.tnt_session_updated_at::text "updatedAt", t.tnt_session_updated_by::text "updatedBy", u.usr_name "updatedByName"
         FROM amb_acm_tenant t LEFT JOIN amb_acm_user u ON u.usr_id = t.tnt_session_updated_by
        WHERE t.tnt_ent_id = $1`,
      [entId],
    );
    return {
      hours: row?.hours ?? DEFAULT_SESSION_HOURS,
      isDefault: row?.hours == null,
      defaultHours: DEFAULT_SESSION_HOURS,
      maxHours: MAX_SESSION_HOURS,
      mobileDays: 30,
      updatedAt: row?.updatedAt ?? null,
      updatedByName: row?.updatedByName ?? null,
    };
  }

  async setSessionHours(entId: string, hours: number, actorId: string) {
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_SESSION_HOURS)
      throw new UnprocessableEntityException('INVALID_SESSION_HOURS');
    const res = await this.tenants.manager.query(
      `UPDATE amb_acm_tenant SET tnt_session_hours=$2, tnt_session_updated_at=now(), tnt_session_updated_by=$3 WHERE tnt_ent_id=$1`,
      [entId, hours, actorId],
    );
    const affected = Array.isArray(res) ? Number(res[1] ?? 0) : 0;
    if (!affected) throw new UnprocessableEntityException('TENANT_NOT_FOUND');
    return this.getSessionPolicy(entId);
  }

}
