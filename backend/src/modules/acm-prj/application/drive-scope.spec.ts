import type { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import {
  DRIVE_SCOPE,
  DriveReconnectRequired,
  hasDriveScope,
  type DriveClient,
} from '../infrastructure/drive.client';
import type { ProjectService } from './project.service';
import { ProjectDriveService, resetDriveTokenCache } from './drive.service';

/**
 * FIX-261020 — drive.file 로 연결된 토큰은 공유폴더에 직접 올린 파일을 못 본다.
 * 토큰 갱신 때 Drive 전체 범위가 없으면 재연결 필요로 표시해야 한다.
 */
describe('Drive full scope', () => {
  it('detects the full Drive scope in a scope string', () => {
    expect(hasDriveScope(`openid email ${DRIVE_SCOPE}`)).toBe(true);
    expect(
      hasDriveScope('openid https://www.googleapis.com/auth/drive.file'),
    ).toBe(false);
    expect(hasDriveScope(undefined)).toBe(true);
  });

  const setup = (scope: string) => {
    resetDriveTokenCache();
    const query = jest.fn((sql: string) =>
      Promise.resolve(
        sql.startsWith('SELECT')
          ? [
              {
                account_id: 'acc',
                token_encrypted: Buffer.from('x'),
                token_iv: Buffer.from('iv'),
                token_auth_tag: Buffer.from('tag'),
              },
            ]
          : [],
      ),
    );
    const svc = new ProjectDriveService(
      { ds: { query } } as unknown as ProjectService,
      {
        token: () =>
          Promise.resolve({ access_token: 'at', expires_in: 3600, scope }),
      } as unknown as DriveClient,
      { decrypt: () => 'refresh' } as unknown as AesGcmService,
    );
    return { svc, query };
  };

  it('flags an old drive.file connection for reconnect', async () => {
    const { svc, query } = setup(
      'openid https://www.googleapis.com/auth/drive.file',
    );
    await expect(svc.token('ent')).rejects.toBeInstanceOf(
      DriveReconnectRequired,
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('needs_reconnect=true'),
      ['ent'],
    );
  });

  it('accepts a token with the full Drive scope', async () => {
    const { svc } = setup(`openid email ${DRIVE_SCOPE}`);
    await expect(svc.token('ent')).resolves.toMatchObject({ token: 'at' });
  });
});
