import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { AuditService } from '../../acm-audit/application/audit.service';

/** REQ-261016B — 전 테넌트 공용 Google OAuth 앱 설정 키(ACM_GOOGLE_{KEY}). */
export const GOOGLE_APP_KEYS = [
  'CLIENT_ID',
  'CLIENT_SECRET',
  'REDIRECT_URI',
  'PICKER_KEY',
  'PROJECT_NUMBER',
] as const;
export type GoogleAppKey = (typeof GOOGLE_APP_KEYS)[number];
export type GoogleAppSource = 'SYSTEM' | 'ENV' | 'NONE';
export const SYSTEM_ENT = '00000000-0000-0000-0000-0000000000ff';

export interface GoogleAppInput {
  clientId: string;
  /** 빈 값이면 저장된 Secret 유지. */
  clientSecret?: string;
  redirectUri: string;
  pickerKey?: string;
  projectNumber?: string;
}

interface Row {
  sga_client_id: string;
  sga_secret_encrypted: Buffer;
  sga_secret_iv: Buffer;
  sga_secret_auth_tag: Buffer;
  sga_redirect_uri: string;
  sga_picker_key: string | null;
  sga_project_number: string | null;
  updated_at: Date;
  updated_by_email: string | null;
}

/** 입력 형식 검증. 위반 시 필드명이 담긴 400. */
export function validateGoogleApp(input: GoogleAppInput, hasSecret: boolean) {
  const errors: string[] = [];
  if (
    !/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(
      input.clientId.trim(),
    )
  )
    errors.push('clientId');
  if (!hasSecret && !input.clientSecret?.trim()) errors.push('clientSecret');
  if (input.clientSecret && !/^[\w-]{10,200}$/.test(input.clientSecret.trim()))
    errors.push('clientSecret');
  try {
    const u = new URL(input.redirectUri.trim());
    const local = ['localhost', '127.0.0.1'].includes(u.hostname);
    if (
      (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) ||
      !u.pathname.endsWith('/api/acm/prj/drive/callback') ||
      u.search ||
      u.hash
    )
      errors.push('redirectUri');
  } catch {
    errors.push('redirectUri');
  }
  if (input.pickerKey && !/^AIza[\w-]{35}$/.test(input.pickerKey.trim()))
    errors.push('pickerKey');
  if (input.projectNumber && !/^\d{6,20}$/.test(input.projectNumber.trim()))
    errors.push('projectNumber');
  if (errors.length)
    throw new BadRequestException({
      code: 'GOOGLE_APP_INVALID',
      message: `형식을 확인하세요: ${errors.join(', ')}`,
      details: { fields: errors },
    });
}

/** 연결 확인 판정: 잘못된 code 로 토큰 교환 → invalid_grant 면 클라이언트 유효. */
export function interpretTokenProbe(status: number, error?: string) {
  if (error === 'invalid_grant') return { ok: true, code: 'OK' };
  if (error === 'invalid_client' || error === 'unauthorized_client')
    return { ok: false, code: 'INVALID_CLIENT' };
  if (error === 'redirect_uri_mismatch')
    return { ok: false, code: 'REDIRECT_MISMATCH' };
  return { ok: false, code: status >= 500 ? 'GOOGLE_UNAVAILABLE' : 'UNKNOWN' };
}

const mask = (v: string | null | undefined, keep = 4) =>
  !v
    ? ''
    : v.length <= keep * 2
      ? '•'.repeat(v.length)
      : `${v.slice(0, keep)}${'•'.repeat(8)}${v.slice(-keep)}`;

/**
 * REQ-261016B — 시스템 설정 저장값(DB) 우선, 없으면 환경변수. 동기 조회를 위해 메모리 캐시를
 * 모듈 시작·60초 주기·저장 직후에 갱신한다.
 */
@Injectable()
export class GoogleAppConfigService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(GoogleAppConfigService.name);
  private cache: (Record<GoogleAppKey, string> & { meta: Row }) | null = null;
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly crypto: AesGcmService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.reload().catch((e: unknown) =>
      this.log.warn(`google app config load failed: ${String(e)}`),
    );
    this.timer = setInterval(
      () => void this.reload().catch(() => undefined),
      60_000,
    );
    this.timer.unref?.();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async reload() {
    const [r] = await this.ds.query<Row[]>(
      `SELECT g.*, u.usr_email AS updated_by_email
         FROM amb_acm_sys_google_app g
         LEFT JOIN amb_acm_user u ON u.usr_id = g.updated_by
        WHERE g.sga_id = 1`,
    );
    this.cache = r
      ? {
          CLIENT_ID: r.sga_client_id,
          CLIENT_SECRET: this.crypto.decrypt({
            ciphertext: r.sga_secret_encrypted,
            iv: r.sga_secret_iv,
            authTag: r.sga_secret_auth_tag,
          }),
          REDIRECT_URI: r.sga_redirect_uri,
          PICKER_KEY: r.sga_picker_key ?? '',
          PROJECT_NUMBER: r.sga_project_number ?? '',
          meta: r,
        }
      : null;
  }

  private env(k: GoogleAppKey) {
    return this.config.get<string>(`ACM_GOOGLE_${k}`) ?? '';
  }
  /** 저장값이 있으면 저장값 전체(행 단위), 없으면 환경변수. */
  get(k: GoogleAppKey): string {
    return this.cache ? this.cache[k] : this.env(k);
  }
  source(): GoogleAppSource {
    if (this.cache) return 'SYSTEM';
    return this.env('CLIENT_ID') &&
      this.env('CLIENT_SECRET') &&
      this.env('REDIRECT_URI')
      ? 'ENV'
      : 'NONE';
  }

  /** 화면용 — Secret 은 존재 여부만, Picker 키는 마스킹. */
  view() {
    const src = this.source();
    return {
      source: src,
      clientId: this.get('CLIENT_ID'),
      hasSecret: !!this.get('CLIENT_SECRET'),
      redirectUri: this.get('REDIRECT_URI'),
      pickerKeyMasked: mask(this.get('PICKER_KEY')),
      hasPickerKey: !!this.get('PICKER_KEY'),
      projectNumber: this.get('PROJECT_NUMBER'),
      updatedAt: this.cache?.meta.updated_at ?? null,
      updatedBy: this.cache?.meta.updated_by_email ?? null,
    };
  }

  async save(input: GoogleAppInput, userId: string) {
    const existingSecret = this.cache?.CLIENT_SECRET ?? '';
    validateGoogleApp(input, !!existingSecret);
    const secret = input.clientSecret?.trim() || existingSecret;
    const changed = this.cache
      ? [
          input.clientId.trim() !== this.cache.CLIENT_ID && 'clientId',
          secret !== this.cache.CLIENT_SECRET && 'clientSecret',
          input.redirectUri.trim() !== this.cache.REDIRECT_URI && 'redirectUri',
          // Picker 키 빈 값 = 유지
          !!input.pickerKey?.trim() &&
            input.pickerKey.trim() !== this.cache.PICKER_KEY &&
            'pickerKey',
          (input.projectNumber?.trim() ?? '') !== this.cache.PROJECT_NUMBER &&
            'projectNumber',
        ].filter(Boolean)
      : ['created'];
    const e = this.crypto.encrypt(secret);
    const picker = input.pickerKey?.trim() || this.cache?.PICKER_KEY || null;
    await this.ds.query(
      `INSERT INTO amb_acm_sys_google_app
         (sga_id, sga_client_id, sga_secret_encrypted, sga_secret_iv, sga_secret_auth_tag,
          sga_redirect_uri, sga_picker_key, sga_project_number, updated_by)
       VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (sga_id) DO UPDATE SET
         sga_client_id=EXCLUDED.sga_client_id, sga_secret_encrypted=EXCLUDED.sga_secret_encrypted,
         sga_secret_iv=EXCLUDED.sga_secret_iv, sga_secret_auth_tag=EXCLUDED.sga_secret_auth_tag,
         sga_redirect_uri=EXCLUDED.sga_redirect_uri, sga_picker_key=EXCLUDED.sga_picker_key,
         sga_project_number=EXCLUDED.sga_project_number, updated_by=EXCLUDED.updated_by`,
      [
        input.clientId.trim(),
        e.ciphertext,
        e.iv,
        e.authTag,
        input.redirectUri.trim(),
        picker,
        input.projectNumber?.trim() || null,
        userId,
      ],
    );
    // 비밀값은 기록하지 않는다 — 바뀐 필드 이름만.
    await this.audit.record({
      entId: SYSTEM_ENT,
      userId,
      action: this.cache ? 'UPDATE' : 'CREATE',
      entityType: 'SYS_GOOGLE_APP',
      entityId: '1',
      fieldName: changed.join(',').slice(0, 100) || null,
    });
    await this.reload();
    return this.view();
  }

  async clear(userId: string) {
    await this.ds.query('DELETE FROM amb_acm_sys_google_app WHERE sga_id = 1');
    await this.audit.record({
      entId: SYSTEM_ENT,
      userId,
      action: 'DELETE',
      entityType: 'SYS_GOOGLE_APP',
      entityId: '1',
    });
    await this.reload();
    return this.view();
  }

  /** 현재 적용 중인 Client ID/Secret/Redirect 를 Google 토큰 엔드포인트로 확인. */
  async test() {
    if (this.source() === 'NONE') return { ok: false, code: 'NOT_CONFIGURED' };
    try {
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: 'acm-config-check',
          redirect_uri: this.get('REDIRECT_URI'),
          client_id: this.get('CLIENT_ID'),
          client_secret: this.get('CLIENT_SECRET'),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      return interpretTokenProbe(r.status, body.error);
    } catch {
      return { ok: false, code: 'GOOGLE_UNAVAILABLE' };
    }
  }
}
