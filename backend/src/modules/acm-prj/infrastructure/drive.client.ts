import { randomUUID } from 'crypto';
import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface GoogleFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  trashed?: boolean;
  parents?: string[];
  capabilities?: { canAddChildren?: boolean };
}
export class DriveWriteRejected extends BadGatewayException {}
const definitiveRejection = (status: number) =>
  [400, 401, 403, 404, 413, 422, 429].includes(status);
@Injectable()
export class DriveClient {
  constructor(readonly config: ConfigService) {}
  setting(k: string) {
    return this.config.get<string>(`ACM_GOOGLE_${k}`) ?? '';
  }
  ready() {
    return !!(
      this.setting('CLIENT_ID') &&
      this.setting('CLIENT_SECRET') &&
      this.setting('REDIRECT_URI')
    );
  }
  async token(
    body: Record<string, string>,
  ): Promise<{ access_token: string; refresh_token?: string }> {
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
    if (!r.ok)
      throw new UnauthorizedException('Google 계정을 다시 연결하세요.');
    return r.json() as Promise<{
      access_token: string;
      refresh_token?: string;
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
    if (!r.ok)
      throw new (
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
      `files?${new URLSearchParams({ q, fields: 'nextPageToken,files(id,name,mimeType,size,parents,trashed)', pageSize: '100', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', ...(pageToken ? { pageToken } : {}) })}`,
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
