import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import {
  packEncrypted,
  unpackEncrypted,
} from '../../acm-auth/infrastructure/ama-secret.codec';
import { AdsProviderClient } from './ads-provider.client';
import {
  AdsConnection,
  AdsError,
  Credentials,
  Report,
  SITES,
  days,
} from './ads.types';
import { SaveConnectionDto, AdjustmentDto } from './ads.dto';
import { lockMarketingDay } from '../application/marketing-resolver';
import {
  readMarketingDay,
  validateMarketingDate,
} from '../application/marketing-input.service';
import { automaticCosts } from './ads-cost';
export const kstDay = () =>
  new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
export const shiftDay = (d: string, n: number) =>
  new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
export const safeError = (e: unknown) =>
  e instanceof AdsError ? e.code : 'INTERNAL_ERROR';
@Injectable()
export class AdsService {
  constructor(
    @InjectDataSource(ACM_DS) readonly ds: DataSource,
    private readonly crypto: AesGcmService,
    readonly client: AdsProviderClient,
  ) {}
  decrypt(c: AdsConnection): Credentials {
    if (!c.credentials_enc) return {};
    return JSON.parse(
      this.crypto.decrypt(
        unpackEncrypted(Buffer.from(c.credentials_enc, 'base64')),
      ),
    ) as Credentials;
  }
  private public(c: AdsConnection) {
    const { credentials_enc, ...rest } = c;
    return { ...rest, credentialsSet: !!credentials_enc };
  }
  async connection(
    ent: string,
    id: string,
    db: DataSource | EntityManager = this.ds,
  ) {
    const [c]: AdsConnection[] = await db.query(
      'SELECT * FROM amb_acm_ads_connection WHERE ent_id=$1 AND adc_id=$2',
      [ent, id],
    );
    if (!c) throw new NotFoundException();
    return c;
  }
  async list(ent: string) {
    const rows: AdsConnection[] = await this.ds.query(
      'SELECT * FROM amb_acm_ads_connection WHERE ent_id=$1 ORDER BY created_at',
      [ent],
    );
    return rows.map((c) => this.public(c));
  }
  async audit(
    db: EntityManager,
    ent: string,
    actor: string | null,
    action: string,
    target: string,
    before: unknown,
    after: unknown,
  ) {
    await db.query(
      'INSERT INTO amb_acm_ads_audit(ent_id,actor_id,action,target_id,before_value,after_value) VALUES($1,$2,$3,$4,$5,$6)',
      [
        ent,
        actor,
        action,
        target,
        JSON.stringify(before),
        JSON.stringify(after),
      ],
    );
  }
  async save(ent: string, actor: string, dto: SaveConnectionDto, id?: string) {
    if (!dto.config || !dto.name.trim())
      throw new BadRequestException('INVALID_CONFIG');
    validateMarketingDate(dto.config.startDate);
    if (dto.provider === 'GOOGLE')
      dto.accountId = dto.accountId.replace(/-/g, '');
    if (!/^(act_)?\d+$/.test(dto.accountId))
      throw new BadRequestException('INVALID_ACCOUNT');
    dto.accountId = dto.accountId.replace(/^act_/, '');
    const mapping = dto.config.campaigns;
    if (
      !mapping ||
      Object.keys(mapping).length > 500 ||
      Object.entries(mapping).some(
        ([key, value]) => !/^[-\w]{1,100}$/.test(key) || !SITES.includes(value),
      )
    )
      throw new BadRequestException('INVALID_MAPPING');
    if (
      dto.credentials &&
      Object.entries(dto.credentials).some(
        ([key, value]) =>
          ![
            'accessToken',
            'clientId',
            'clientSecret',
            'refreshToken',
            'apiKey',
            'secretKey',
          ].includes(key) ||
          typeof value !== 'string' ||
          value.length > 20000,
      )
    )
      throw new BadRequestException('INVALID_CREDENTIALS');
    return this.ds.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `${ent}:ads:${dto.provider}:${dto.accountId}`,
      ]);
      if (id)
        await m.query(
          'SELECT adc_id FROM amb_acm_ads_connection WHERE ent_id=$1 AND adc_id=$2 FOR UPDATE',
          [ent, id],
        );
      const old = id ? await this.connection(ent, id, m) : null;
      if (
        old &&
        (old.revision !== dto.expectedRevision ||
          old.provider !== dto.provider ||
          old.account_id !== dto.accountId)
      )
        throw new ConflictException('CONNECTION_CHANGED');
      const effective = dto.config.mappingEffectiveFrom ?? dto.config.startDate;
      validateMarketingDate(effective);
      if (effective < dto.config.startDate)
        throw new BadRequestException('INVALID_MAPPING_DATE');
      const mappingChanged =
        !old ||
        old.config.defaultSite !== dto.config.defaultSite ||
        JSON.stringify(old.config.campaigns) !==
          JSON.stringify(dto.config.campaigns);
      const used: Array<{ exists: number }> = old
        ? await m.query(
            'SELECT 1 FROM amb_acm_ads_day_coverage WHERE ent_id=$1 AND adc_id=$2 LIMIT 1',
            [ent, id],
          )
        : [];
      if (
        used.length &&
        (old!.config.startDate !== dto.config.startDate ||
          (mappingChanged && effective < kstDay()))
      )
        throw new ConflictException('HISTORICAL_MAPPING_REQUIRES_REVIEW');
      const credentials = {
        ...(old ? this.decrypt(old) : {}),
        ...Object.fromEntries(
          Object.entries(dto.credentials ?? {}).filter(([, v]) => v !== ''),
        ),
      };
      const encrypted = Object.keys(credentials).length
        ? packEncrypted(
            this.crypto.encrypt(JSON.stringify(credentials)),
          ).toString('base64')
        : null;
      const duplicate: Array<{ adc_id: string }> = await m.query(
        'SELECT adc_id FROM amb_acm_ads_connection WHERE ent_id=$1 AND provider=$2 AND account_id=$3',
        [ent, dto.provider, dto.accountId],
      );
      if (duplicate.length && duplicate[0].adc_id !== id)
        throw new ConflictException('ACCOUNT_EXISTS');
      const [saved]: AdsConnection[] = old
        ? await m.query(
            'WITH changed AS (UPDATE amb_acm_ads_connection SET name=$3,config=$4,credentials_enc=$5,revision=revision+1,active=false,tested_revision=NULL,test_result=NULL,disconnected_at=NULL,updated_at=now() WHERE ent_id=$1 AND adc_id=$2 RETURNING *) SELECT * FROM changed',
            [ent, id, dto.name.trim(), dto.config, encrypted],
          )
        : await m.query(
            'INSERT INTO amb_acm_ads_connection(ent_id,provider,account_id,name,config,credentials_enc) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
            [
              ent,
              dto.provider,
              dto.accountId,
              dto.name.trim(),
              dto.config,
              encrypted,
            ],
          );
      if (mappingChanged)
        await m.query(
          'INSERT INTO amb_acm_ads_mapping(ent_id,adc_id,effective_from,mapping,revision) VALUES($1,$2,$3,$4,$5) ON CONFLICT(adc_id,effective_from) DO UPDATE SET mapping=EXCLUDED.mapping,revision=EXCLUDED.revision,updated_at=now()',
          [ent, saved.adc_id, effective, dto.config, saved.revision],
        );
      await this.audit(
        m,
        ent,
        actor,
        'SAVE',
        saved.adc_id,
        old ? this.public(old) : null,
        this.public(saved),
      );
      return this.public(saved);
    });
  }
  validateReport(c: AdsConnection, r: Report, from: string, to: string) {
    if (r.currency !== 'KRW' || r.timeZone !== 'Asia/Seoul')
      throw new AdsError('KRW_KST_REQUIRED');
    const seen = new Set<string>();
    for (const row of r.rows) {
      const key = `${row.date}:${row.campaignId}`;
      if (
        !days(from, to).includes(row.date) ||
        !row.campaignId ||
        row.campaignId.length > 100 ||
        row.campaignName.length > 300 ||
        !/^\d+$/.test(row.micros) ||
        BigInt(row.micros) > 999999999999000000n ||
        seen.has(key)
      )
        throw new AdsError('INVALID_REPORT');
      seen.add(key);
    }
    if (
      r.rows.reduce((sum, row) => sum + BigInt(row.micros), 0n) >
      999999999999000000n
    )
      throw new AdsError('COST_LIMIT');
    return r.campaigns.filter(
      (x) => !c.config.campaigns[x.id] && !c.config.defaultSite,
    ).length;
  }
  async test(ent: string, id: string) {
    const c = await this.connection(ent, id),
      date = shiftDay(kstDay(), -1);
    let result: Record<string, unknown>;
    try {
      const r = await this.client.report(c, this.decrypt(c), date, date);
      const unmapped = this.validateReport(c, r, date, date);
      result = {
        ok: true,
        date,
        currency: r.currency,
        timeZone: r.timeZone,
        unmapped,
        campaigns: r.campaigns,
        totalMicros: r.rows
          .reduce((s, r) => s + BigInt(r.micros), 0n)
          .toString(),
      };
    } catch (e) {
      result = { ok: false, code: safeError(e) };
    }
    const saved: Array<{ adc_id: string }> = await this.ds.query(
      'WITH changed AS (UPDATE amb_acm_ads_connection SET test_result=$4,tested_revision=CASE WHEN $5 THEN revision ELSE NULL END,updated_at=now() WHERE ent_id=$1 AND adc_id=$2 AND revision=$3 RETURNING adc_id) SELECT * FROM changed',
      [ent, id, c.revision, result, result.ok === true],
    );
    if (!saved.length) throw new ConflictException('CONNECTION_CHANGED');
    return result;
  }
  async state(
    ent: string,
    actor: string,
    id: string,
    revision: number,
    action: 'enable' | 'pause' | 'disconnect',
  ) {
    return this.ds.transaction(async (m) => {
      await m.query(
        'SELECT adc_id FROM amb_acm_ads_connection WHERE ent_id=$1 AND adc_id=$2 FOR UPDATE',
        [ent, id],
      );
      const c = await this.connection(ent, id, m);
      if (c.revision !== revision)
        throw new ConflictException('CONNECTION_CHANGED');
      if (
        action === 'enable' &&
        (c.provider === 'NAVER_GFA' ||
          c.tested_revision !== revision ||
          !(c.test_result as { ok?: boolean })?.ok ||
          (c.test_result as { unmapped?: number })?.unmapped ||
          (!c.config.defaultSite && !Object.keys(c.config.campaigns).length))
      )
        throw new BadRequestException('TEST_AND_MAPPING_REQUIRED');
      await m.query(
        `UPDATE amb_acm_ads_connection SET active=$3,revision=revision+1,tested_revision=CASE WHEN $3 THEN revision+1 ELSE NULL END,credentials_enc=CASE WHEN $4 THEN NULL ELSE credentials_enc END,disconnected_at=CASE WHEN $4 THEN now() ELSE disconnected_at END,updated_at=now() WHERE ent_id=$1 AND adc_id=$2`,
        [ent, id, action === 'enable', action === 'disconnect'],
      );
      await this.audit(
        m,
        ent,
        actor,
        action.toUpperCase(),
        id,
        { active: c.active },
        { active: action === 'enable' },
      );
      return { ok: true };
    });
  }
  async enqueue(
    ent: string,
    id: string,
    from: string,
    to: string,
    scheduledDate: string | null = null,
  ) {
    days(from, to);
    const c = await this.connection(ent, id);
    if (!c.active || from < c.config.startDate || to >= kstDay())
      throw new BadRequestException('INVALID_SYNC_RANGE_OR_INACTIVE');
    return this.ds.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `ads:${id}`,
      ]);
      if (!scheduledDate) {
        const pending: Array<{ adr_id: string }> = await m.query(
          "SELECT adr_id FROM amb_acm_ads_run WHERE ent_id=$1 AND adc_id=$2 AND status IN ('QUEUED','RUNNING')",
          [ent, id],
        );
        if (pending.length) throw new ConflictException('SYNC_PENDING');
      }
      const rows: Array<{ adr_id: string }> = await m.query(
        'INSERT INTO amb_acm_ads_run(ent_id,adc_id,trigger_type,scheduled_date,from_date,to_date,revision) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(adc_id,scheduled_date) DO NOTHING RETURNING adr_id',
        [
          ent,
          id,
          scheduledDate ? 'DAILY' : 'MANUAL',
          scheduledDate,
          from,
          to,
          c.revision,
        ],
      );
      return rows[0] ?? { alreadyQueued: true };
    });
  }
  async runs(ent: string, id: string) {
    await this.connection(ent, id);
    return this.ds.query<
      Array<{
        adr_id: string;
        trigger_type: string;
        from_date: string;
        to_date: string;
        status: string;
        result: unknown;
        error_code: string | null;
        created_at: string;
        updated_at: string;
      }>
    >(
      'SELECT adr_id,trigger_type,from_date::text,to_date::text,status,result,error_code,created_at,updated_at FROM amb_acm_ads_run WHERE ent_id=$1 AND adc_id=$2 ORDER BY created_at DESC LIMIT 50',
      [ent, id],
    );
  }
  async costDetails(ent: string, date: string) {
    validateMarketingDate(date);
    const day = await readMarketingDay(this.ds, ent, date);
    return {
      revision: day.revision,
      rows: await automaticCosts(this.ds, ent, date, date),
      unmapped: await this.ds.query<
        Array<{ name: string; provider: string; micros: string }>
      >(
        'SELECT c.name,c.provider,SUM(s.amount_micros)::text AS micros FROM amb_acm_ads_daily_spend s JOIN amb_acm_ads_connection c ON c.ent_id=s.ent_id AND c.adc_id=s.adc_id WHERE s.ent_id=$1 AND s.date=$2 AND s.site IS NULL GROUP BY c.name,c.provider',
        [ent, date],
      ),
      sources: await this.ds.query<
        Array<{
          name: string;
          provider: string;
          last_error: string | null;
          last_success_at: string | null;
          date: string | null;
          micros: string | null;
        }>
      >(
        'SELECT c.name,c.provider,c.last_error,c.last_success_at,v.date::text,(SELECT SUM(s.amount_micros)::text FROM amb_acm_ads_daily_spend s WHERE s.ent_id=c.ent_id AND s.adc_id=c.adc_id AND s.date=$2) AS micros FROM amb_acm_ads_connection c LEFT JOIN amb_acm_ads_day_coverage v ON v.ent_id=c.ent_id AND v.adc_id=c.adc_id AND v.date=$2 WHERE c.ent_id=$1 AND (c.active OR v.date IS NOT NULL)',
        [ent, date],
      ),
      sites: day.sites,
      legacyCommonCost: day.legacyCommonCost,
    };
  }
  async costHistory(ent: string, date: string) {
    validateMarketingDate(date);
    return this.ds.query<
      Array<{
        action: string;
        target_id: string;
        before_value: unknown;
        after_value: unknown;
        created_at: string;
      }>
    >(
      "SELECT action,target_id,before_value,after_value,created_at FROM amb_acm_ads_audit WHERE ent_id=$1 AND action='ADJUST' AND target_id LIKE $2 ORDER BY created_at DESC LIMIT 100",
      [ent, `${date}:%`],
    );
  }
  async adjust(ent: string, actor: string, date: string, d: AdjustmentDto) {
    validateMarketingDate(date);
    if (!d.reason.trim()) throw new BadRequestException('REASON_REQUIRED');
    return this.ds.transaction(async (m) => {
      await lockMarketingDay(m, ent, date);
      const before = await readMarketingDay(m, ent, date);
      if (before.revision !== d.expectedRevision)
        throw new ConflictException('MARKETING_CHANGED');
      const rows = await automaticCosts(m, ent, date, date),
        row = rows.find((r) => r.site === d.site && r.provider === d.provider);
      if (!row) throw new BadRequestException('NO_AUTOMATIC_COST');
      if (
        d.mode !== 'RESET' &&
        (d.mode === 'FIXED' ? d.amount : row.original + d.amount) < 0
      )
        throw new BadRequestException('NEGATIVE_COST');
      if (d.mode === 'RESET')
        await m.query(
          'DELETE FROM amb_acm_ads_adjustment WHERE ent_id=$1 AND date=$2 AND site=$3 AND provider=$4',
          [ent, date, d.site, d.provider],
        );
      else
        await m.query(
          'INSERT INTO amb_acm_ads_adjustment(ent_id,date,site,provider,mode,amount,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(ent_id,date,site,provider) DO UPDATE SET mode=EXCLUDED.mode,amount=EXCLUDED.amount,reason=EXCLUDED.reason,actor_id=EXCLUDED.actor_id,updated_at=now()',
          [
            ent,
            date,
            d.site,
            d.provider,
            d.mode,
            d.amount,
            d.reason.trim(),
            actor,
          ],
        );
      if (d.manualMode)
        await m.query(
          'INSERT INTO amb_acm_ads_cost_policy(ent_id,date,site,manual_mode) VALUES($1,$2,$3,$4) ON CONFLICT(ent_id,date,site) DO UPDATE SET manual_mode=EXCLUDED.manual_mode,updated_at=now()',
          [ent, date, d.site, d.manualMode],
        );
      await m.query(
        'UPDATE amb_acm_dsh_marketing_day SET revision=revision+1,updated_at=now() WHERE ent_id=$1 AND date=$2',
        [ent, date],
      );
      const after = await automaticCosts(m, ent, date, date);
      if (
        after.reduce((sum, r) => sum + Math.max(r.original, r.amount), 0) >
        999999999999
      )
        throw new BadRequestException('COST_LIMIT');
      await this.audit(
        m,
        ent,
        actor,
        'ADJUST',
        `${date}:${d.site}:${d.provider}`,
        row,
        d,
      );
      return { ok: true };
    });
  }
}
