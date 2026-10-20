import { ProjectDriveService } from './drive.service';
import type { ProjectService } from './project.service';
import type { DriveClient } from '../infrastructure/drive.client';
import type { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import type { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';

/** FIX-261020C — 공용폴더 없이도 프로젝트 폴더로 업로드, 같은 계정 재연결 시 공용폴더 복원. */
const FOLDER = 'application/vnd.google-apps.folder';
const u = { entId: 'e1', id: 'u1', role: 'ADMIN' } as AcmCurrentUser;

function setup(
  rows: Record<string, unknown[]>,
  files: Record<string, unknown> = {},
) {
  const query = jest.fn(async (sql: string, _params?: unknown[]) => {
    const key = Object.keys(rows).find((k) => sql.includes(k));
    return key ? rows[key] : [];
  });
  const google = {
    file: jest.fn(async (_t: string, id: string) => {
      if (!(id in files)) throw new Error('404');
      return files[id];
    }),
  };
  const svc = new ProjectDriveService(
    { ds: { query } } as unknown as ProjectService,
    google as unknown as DriveClient,
    {} as AesGcmService,
  );
  return { svc, query, google };
}

describe('ProjectDriveService.projectReady', () => {
  it('is ready when the shared root folder is set', async () => {
    const { svc } = setup({
      'FROM amb_acm_prj_drive': [
        { account_id: 'a', root_id: 'root', needs_reconnect: false },
      ],
    });
    await expect(svc.projectReady(u, 'p')).resolves.toBe(true);
  });
  it('uses the existing project folder of the same account when no root is set', async () => {
    const { svc } = setup({
      'FROM amb_acm_prj_drive': [
        { account_id: 'a', root_id: null, needs_reconnect: false },
      ],
      'FROM amb_acm_prj_project': [
        { drive_folder_id: 'pf', drive_account_id: 'a' },
      ],
    });
    await expect(svc.projectReady(u, 'p')).resolves.toBe(true);
  });
  it('is not ready for another account, a project without folder, reconnect or no connection', async () => {
    const other = setup({
      'FROM amb_acm_prj_drive': [
        { account_id: 'a', root_id: null, needs_reconnect: false },
      ],
      'FROM amb_acm_prj_project': [
        { drive_folder_id: 'pf', drive_account_id: 'b' },
      ],
    });
    await expect(other.svc.projectReady(u, 'p')).resolves.toBe(false);
    const none = setup({
      'FROM amb_acm_prj_drive': [
        { account_id: 'a', root_id: null, needs_reconnect: false },
      ],
      'FROM amb_acm_prj_project': [
        { drive_folder_id: null, drive_account_id: null },
      ],
    });
    await expect(none.svc.projectReady(u, 'p')).resolves.toBe(false);
    const reconnect = setup({
      'FROM amb_acm_prj_drive': [
        { account_id: 'a', root_id: 'root', needs_reconnect: true },
      ],
    });
    await expect(reconnect.svc.projectReady(u, 'p')).resolves.toBe(false);
    await expect(setup({}).svc.projectReady(u, 'p')).resolves.toBe(false);
  });
});

describe('ProjectDriveService.restoreRoot', () => {
  it('restores the parent of a project folder as the shared root', async () => {
    const { svc, query } = setup(
      {
        'SELECT root_id FROM amb_acm_prj_drive': [{ root_id: null }],
        'FROM amb_acm_prj_project': [{ drive_folder_id: 'pf' }],
      },
      {
        pf: { id: 'pf', parents: ['root'] },
        root: {
          id: 'root',
          name: 'ACM 공용',
          mimeType: FOLDER,
          trashed: false,
          capabilities: { canAddChildren: true },
        },
      },
    );
    await svc.restoreRoot('e1', 'a', 'tok');
    const update = query.mock.calls.find(([sql]) =>
      String(sql).startsWith('UPDATE amb_acm_prj_drive'),
    );
    expect(update?.[1]).toEqual(['e1', 'a', 'root', 'ACM 공용']);
  });
  it('does nothing when a root exists, and skips unusable parents without failing', async () => {
    const kept = setup({
      'SELECT root_id FROM amb_acm_prj_drive': [{ root_id: 'r' }],
    });
    await kept.svc.restoreRoot('e1', 'a', 'tok');
    expect(kept.google.file).not.toHaveBeenCalled();
    const bad = setup(
      {
        'SELECT root_id FROM amb_acm_prj_drive': [{ root_id: null }],
        'FROM amb_acm_prj_project': [
          { drive_folder_id: 'gone' },
          { drive_folder_id: 'pf' },
        ],
      },
      {
        pf: { id: 'pf', parents: ['root'] },
        root: { id: 'root', name: 'x', mimeType: FOLDER, trashed: true },
      },
    );
    await expect(
      bad.svc.restoreRoot('e1', 'a', 'tok'),
    ).resolves.toBeUndefined();
    expect(
      bad.query.mock.calls.some(([sql]) => String(sql).startsWith('UPDATE')),
    ).toBe(false);
  });
});
