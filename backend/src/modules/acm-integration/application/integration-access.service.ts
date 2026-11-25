import { HttpException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  SCOPES,
  type ApiSettingsDto,
  type IssueKeyDto,
  type Scope,
} from './dto/scheduler.dto';
import type { IntegrationPrincipal } from './scheduler.types';

export function apiError(
  status: number,
  code: string,
  details?: unknown,
): never {
  throw new HttpException(
    { code, message: code, ...(details ? { details } : {}) },
    status,
  );
}
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
interface KeyRow {
  ent_id: string;
  icl_id: string;
  iak_id: string;
  icl_actor_id: string;
  icl_name: string;
  iak_hash: string;
  iak_scopes: Scope[];
  int_scopes: Scope[];
  iak_expires_at: Date;
  iak_revoked_at: Date | null;
  int_is_enabled: boolean;
  icl_is_active: boolean;
  usr_status: string;
  tnt_status: string;
}
@Injectable()
export class IntegrationAccessService {
  private readonly log = new Logger(IntegrationAccessService.name);
  constructor(@InjectDataSource(ACM_DS) readonly ds: DataSource) {}

  @Cron('0 20 * * * *')
  async purgeExpiredRequests() {
    try {
      await this.ds.query(
        'DELETE FROM amb_acm_int_request WHERE irq_expires_at<=now()',
      );
    } catch {
      this.log.warn('Expired integration request cleanup failed');
    }
  }

  async audit(
    m: EntityManager,
    ent: string,
    actor: string,
    action: string,
    target?: string,
    client?: string,
    key?: string,
  ) {
    await m.query(
      `INSERT INTO amb_acm_int_audit(ent_id,iau_actor_id,iau_action,iau_target_id,icl_id,iak_id) VALUES($1,$2,$3,$4,$5,$6)`,
      [ent, actor, action, target ?? null, client ?? null, key ?? null],
    );
  }
  async settings(ent: string) {
    const rows = await this.ds.query<
      { int_is_enabled: boolean; int_scopes: Scope[] }[]
    >(
      'SELECT int_is_enabled,int_scopes FROM amb_acm_int_config WHERE ent_id=$1',
      [ent],
    );
    return {
      enabled: rows[0]?.int_is_enabled ?? false,
      scopes: rows[0]?.int_scopes ?? [...SCOPES],
    };
  }
  async saveSettings(ent: string, actor: string, dto: ApiSettingsDto) {
    await this.ds.transaction(async (m) => {
      await m.query(
        `INSERT INTO amb_acm_int_config(ent_id,int_is_enabled,int_scopes,updated_by) VALUES($1,$2,$3,$4)
        ON CONFLICT(ent_id) DO UPDATE SET int_is_enabled=EXCLUDED.int_is_enabled,int_scopes=EXCLUDED.int_scopes,updated_by=EXCLUDED.updated_by`,
        [ent, dto.enabled, JSON.stringify(dto.scopes), actor],
      );
      await this.audit(m, ent, actor, 'SETTINGS_UPDATED');
    });
    return this.settings(ent);
  }
  async clients(ent: string) {
    const clients = await this.ds.query<
      { id: string; name: string; active: boolean; actorId: string }[]
    >(
      'SELECT icl_id AS id,icl_name AS name,icl_is_active AS active,icl_actor_id AS "actorId" FROM amb_acm_int_client WHERE ent_id=$1 ORDER BY created_at',
      [ent],
    );
    const keys = await this.ds.query<{ clientId: string }[]>(
      `SELECT iak_id AS id,icl_id AS "clientId",iak_name AS name,iak_scopes AS scopes,
      iak_expires_at AS "expiresAt",iak_revoked_at AS "revokedAt",iak_last_used_at AS "lastUsedAt" FROM amb_acm_int_api_key WHERE ent_id=$1 ORDER BY created_at`,
      [ent],
    );
    return clients.map((c) => ({
      ...c,
      keys: keys.filter((k) => k.clientId === c.id),
    }));
  }
  async addClient(ent: string, actor: string, name: string) {
    return this.ds.transaction(async (m) => {
      const [row] = await m.query<{ id: string }[]>(
        `INSERT INTO amb_acm_int_client(ent_id,icl_name,icl_actor_id) VALUES($1,$2,$3) RETURNING icl_id AS id`,
        [ent, name, actor],
      );
      await this.audit(m, ent, actor, 'CLIENT_CREATED', row.id, row.id);
      return row;
    });
  }
  async setClient(ent: string, actor: string, id: string, active: boolean) {
    return this.ds.transaction(async (m) => {
      const rows = await m.query<{ id: string }[]>(
        `WITH changed AS (UPDATE amb_acm_int_client SET icl_is_active=$3,icl_actor_id=$4 WHERE ent_id=$1 AND icl_id=$2 RETURNING icl_id AS id) SELECT * FROM changed`,
        [ent, id, active, actor],
      );
      if (!rows[0]) apiError(404, 'CLIENT_NOT_FOUND');
      await this.audit(
        m,
        ent,
        actor,
        active ? 'CLIENT_ENABLED' : 'CLIENT_DISABLED',
        id,
        id,
      );
      return { id, active };
    });
  }
  async issueKey(ent: string, actor: string, client: string, dto: IssueKeyDto) {
    const expires = new Date(dto.expiresAt);
    if (
      expires <= new Date() ||
      expires.getTime() > Date.now() + 366 * 86400000
    )
      apiError(400, 'INVALID_KEY_EXPIRY');
    const id = randomUUID();
    const secret = `acm_sk_${id}_${randomBytes(32).toString('base64url')}`;
    await this.ds.transaction(async (m) => {
      const rows = await m.query<unknown[]>(
        `SELECT icl_id FROM amb_acm_int_client WHERE ent_id=$1 AND icl_id=$2 FOR SHARE`,
        [ent, client],
      );
      if (!rows.length) apiError(404, 'CLIENT_NOT_FOUND');
      await m.query(
        `INSERT INTO amb_acm_int_api_key(iak_id,ent_id,icl_id,iak_name,iak_hash,iak_scopes,iak_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          ent,
          client,
          dto.name,
          digest(secret),
          JSON.stringify(dto.scopes),
          expires,
        ],
      );
      await this.audit(m, ent, actor, 'KEY_ISSUED', id, client, id);
    });
    return { id, secret, expiresAt: expires.toISOString() };
  }
  async revokeKey(ent: string, actor: string, id: string) {
    await this.ds.transaction(async (m) => {
      const rows = await m.query<{ icl_id: string }[]>(
        `WITH changed AS (UPDATE amb_acm_int_api_key SET iak_revoked_at=COALESCE(iak_revoked_at,now()) WHERE ent_id=$1 AND iak_id=$2 RETURNING icl_id) SELECT * FROM changed`,
        [ent, id],
      );
      if (!rows.length) apiError(404, 'KEY_NOT_FOUND');
      await this.audit(m, ent, actor, 'KEY_REVOKED', id, rows[0].icl_id, id);
    });
    return { id, revoked: true };
  }
  private async keyRow(id: string, manager = this.ds.manager, lock = false) {
    const rows = await manager.query<KeyRow[]>(
      `SELECT k.*,c.icl_name,c.icl_actor_id,c.icl_is_active,COALESCE(s.int_is_enabled,false) AS int_is_enabled,COALESCE(s.int_scopes,'[]'::jsonb) AS int_scopes,u.usr_status,t.tnt_status
      FROM amb_acm_int_api_key k JOIN amb_acm_int_client c USING(ent_id,icl_id)
      LEFT JOIN amb_acm_int_config s USING(ent_id) JOIN amb_acm_tenant t ON t.tnt_ent_id=k.ent_id
      JOIN amb_acm_user u ON u.usr_id=c.icl_actor_id AND u.ent_id=c.ent_id
      WHERE k.iak_id=$1 ${lock ? 'FOR SHARE OF k,c,u,t' : ''}`,
      [id],
    );
    return rows[0];
  }
  private check(row: KeyRow | undefined, scope: Scope) {
    if (
      !row ||
      row.iak_revoked_at ||
      new Date(row.iak_expires_at) <= new Date()
    )
      apiError(401, 'INVALID_API_KEY');
    if (
      !row.int_is_enabled ||
      !row.icl_is_active ||
      row.tnt_status !== 'ACTIVE' ||
      row.usr_status !== 'ACTIVE' ||
      !row.int_scopes.includes(scope)
    )
      apiError(403, 'INTEGRATION_DISABLED');
    if (!row.iak_scopes.includes(scope)) apiError(403, 'INSUFFICIENT_SCOPE');
    return row;
  }
  async authenticate(
    header: string | undefined,
    scope: Scope,
  ): Promise<IntegrationPrincipal> {
    const match = /^Bearer (acm_sk_([0-9a-f-]{36})_[A-Za-z0-9_-]{43})$/.exec(
      header ?? '',
    );
    if (
      !match ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        match[2],
      )
    )
      apiError(401, 'INVALID_API_KEY');
    const row = await this.keyRow(match[2]);
    const actual = Buffer.from(digest(match[1]), 'hex');
    const expected = Buffer.from(row?.iak_hash ?? '0'.repeat(64), 'hex');
    if (!timingSafeEqual(actual, expected)) apiError(401, 'INVALID_API_KEY');
    this.check(row, scope);
    await this.entitlement(this.ds.manager, row.ent_id, scope);
    const [count] = await this.ds.query<{ iak_count: number }[]>(
      `WITH counted AS (UPDATE amb_acm_int_api_key SET
      iak_count=CASE WHEN iak_window=date_trunc('minute',now()) THEN iak_count+1 ELSE 1 END,
      iak_window=date_trunc('minute',now()),iak_last_used_at=now() WHERE iak_id=$1 RETURNING iak_count) SELECT iak_count FROM counted`,
      [row.iak_id],
    );
    if (count.iak_count > 60) apiError(429, 'RATE_LIMITED');
    return {
      entId: row.ent_id,
      clientId: row.icl_id,
      keyId: row.iak_id,
      actorId: row.icl_actor_id,
      clientName: row.icl_name,
      scopes: row.iak_scopes,
    };
  }
  async recheck(m: EntityManager, p: IntegrationPrincipal, scope: Scope) {
    await m.query(
      'SELECT ent_id FROM amb_acm_int_config WHERE ent_id=$1 FOR SHARE',
      [p.entId],
    );
    const row = this.check(await this.keyRow(p.keyId, m, true), scope);
    if (row.ent_id !== p.entId || row.icl_id !== p.clientId)
      apiError(401, 'INVALID_API_KEY');
    p.actorId = row.icl_actor_id;
    p.clientName = row.icl_name;
    await this.entitlement(m, p.entId, scope);
  }
  private async entitlement(m: EntityManager, ent: string, scope: Scope) {
    const feature = scope === 'teachers:read' ? 'tch' : 'cal';
    const denied = await m.query<unknown[]>(
      `SELECT 1 FROM amb_acm_tenant_menu WHERE tnm_ent_id=$1 AND tnm_menu_key=$2 AND tnm_visible=false`,
      [ent, feature],
    );
    if (denied.length) apiError(403, 'INTEGRATION_DISABLED');
  }
}
