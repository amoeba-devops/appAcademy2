import { randomUUID } from 'crypto';
import {
  BadGatewayException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GoogleAppConfigService,
  type GoogleAppKey,
} from '../application/google-app-config.service';
export interface GoogleFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  trashed?: boolean;
  parents?: string[];
  capabilities?: { canAddChildren?: boolean };
  // REQ-261016E — 드라이브 화면(AMA 동일) 표시용
  modifiedTime?: string;
  createdTime?: string;
  owners?: { displayName?: string; emailAddress?: string }[];
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
}
/** 목록·상세 공통 필드(REQ-261016E). */
const LIST_FIELDS =
  'id,name,mimeType,size,parents,trashed,modifiedTime,createdTime,owners(displayName,emailAddress),thumbnailLink,webViewLink';
export class DriveWriteRejected extends BadGatewayException {}
/** Google refresh token 이 만료·철회됨. ACM 세션과 무관하므로 409. */
export class DriveReconnectRequired extends ConflictException {
  constructor() {
    super({
      code: 'DRIVE_RECONNECT_REQUIRED',
      message:
        'Google Drive 연결이 만료되었습니다. 서비스 운영자가 다시 연결해야 합니다.',
    });
  }
}
/** Google Drive 응답 코드(요청 실패 시 예외에 붙는다). */
export const googleStatusOf = (e: unknown): number | undefined =>
  typeof e === 'object' && e !== null && 'googleStatus' in e
    ? (e as { googleStatus?: number }).googleStatus
    : undefined;
const definitiveRejection = (status: number) =>
  [400, 401, 403, 404, 413, 422, 429].includes(status);
@Injectable()
export class DriveClient {
  constructor(readonly app: GoogleAppConfigService) {}
  /** REQ-261016B — 시스템 설정 저장값 우선, 없으면 ACM_GOOGLE_* 환경변수. */
  setting(k: GoogleAppKey) {
    return this.app.get(k);
  }
  ready() {
    return !!(
      this.setting('CLIENT_ID') &&
      this.setting('CLIENT_SECRET') &&
      this.setting('REDIRECT_URI')
    );
  }
  async token(body: Record<string, string>): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    if (!this.ready())
      throw new ServiceUnavailableException('Google 연결 설정이 필요합니다.');
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...body,
        client_id: this.setting('CLIENT_ID'),
        client_secret: this.setting('CLIENT_SECRET'),
      }),
      signal: AbortSignal.timeout(15000),
    });
    // REQ-261016 — 401 은 프론트에서 ACM 세션 만료로 처리되어 로그아웃된다. 409 로 구분한다.
    if (!r.ok) throw new DriveReconnectRequired();
    return r.json() as Promise<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>;
  }
  async request<T>(
    token: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const r = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      const err = new (
        init.method === 'POST' && definitiveRejection(r.status)
          ? DriveWriteRejected
          : BadGatewayException
      )(
        r.status === 401
          ? 'Google 계정을 다시 연결하세요.'
          : r.status === 403
            ? 'Google 파일 접근 권한을 확인하세요.'
            : r.status === 404
              ? 'Google 파일이 없거나 접근할 수 없습니다.'
              : 'Google Drive 요청을 완료하지 못했습니다.',
      );
      // 호출 측이 Google 응답 코드로 분기할 수 있게 남긴다(예: 보이지 않는 상위 폴더).
      Object.assign(err, { googleStatus: r.status });
      throw err;
    }
    return r.json() as Promise<T>;
  }
  file(t: string, id: string) {
    return this.request<GoogleFile>(
      t,
      `files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,mimeType,size,parents,trashed,capabilities(canAddChildren)`,
    );
  }
  list(t: string, q: string, pageToken?: string) {
    return this.request<{ files: GoogleFile[]; nextPageToken?: string }>(
      t,
      `files?${new URLSearchParams({ q, fields: `nextPageToken,files(${LIST_FIELDS})`, pageSize: '100', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', ...(pageToken ? { pageToken } : {}) })}`,
    );
  }
  /** REQ-261016E — 파일 상세(소유자·수정일·링크). */
  detail(t: string, id: string) {
    return this.request<GoogleFile>(
      t,
      `files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=${LIST_FIELDS},webContentLink`,
    );
  }
  /** REQ-261016E — 이름 변경·이동(부모 교체)·휴지통. 영구 삭제는 하지 않는다. */
  update(
    t: string,
    id: string,
    body: Record<string, unknown>,
    query: Record<string, string> = {},
  ) {
    return this.request<GoogleFile>(
      t,
      `files/${encodeURIComponent(id)}?${new URLSearchParams({ supportsAllDrives: 'true', fields: LIST_FIELDS, ...query })}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    );
  }
  create(t: string, body: Record<string, unknown>) {
    return this.request<GoogleFile>(
      t,
      'files?supportsAllDrives=true&fields=id,name,mimeType,size',
      { method: 'POST', body: JSON.stringify(body) },
    );
  }
  async upload(
    t: string,
    metadata: Record<string, unknown>,
    file: Express.Multer.File,
  ) {
    const boundary = `acm_${randomUUID()}`;
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
      ),
      file.buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const r = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!r.ok)
      throw new (
        definitiveRejection(r.status) ? DriveWriteRejected : BadGatewayException
      )(
        '파일 업로드에 실패했습니다. 권한 또는 용량을 확인하고 다시 시도하세요.',
      );
    return r.json() as Promise<GoogleFile>;
  }
}
