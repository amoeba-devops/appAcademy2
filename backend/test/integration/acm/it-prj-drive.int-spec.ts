import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { ProjectService } from '../../../src/modules/acm-prj/application/project.service';
import {
  ProjectDriveService,
  safeReturn,
} from '../../../src/modules/acm-prj/application/drive.service';
import {
  DriveClient,
  DriveWriteRejected,
} from '../../../src/modules/acm-prj/infrastructure/drive.client';
import { AesGcmService } from '../../../src/modules/acm-common/crypto/aes-gcm.service';
import { ConfigService } from '@nestjs/config';
import type { AcmCurrentUser } from '../../../src/modules/acm-common/decorators/current-user.decorator';

describe('Project / shared Drive isolation and durable operations', () => {
  let container: StartedPostgreSqlContainer,
    ds: DataSource,
    projects: ProjectService,
    drive: ProjectDriveService;
  const ent = randomUUID(),
    otherEnt = randomUUID(),
    owner = { id: randomUUID(), entId: ent, role: 'ADMIN' } as AcmCurrentUser,
    member = { id: randomUUID(), entId: ent, role: 'STAFF' } as AcmCurrentUser,
    outsider = {
      id: randomUUID(),
      entId: otherEnt,
      role: 'ADMIN',
    } as AcmCurrentUser;
  let projectId: string;
  const google = {
    ready: () => true,
    setting: (key: string) =>
      key === 'CLIENT_ID'
        ? 'client'
        : 'https://acm.example/api/acm/prj/drive/callback',
    token: jest.fn(),
    create: jest.fn(),
    list: jest.fn(),
    file: jest.fn(),
  } as unknown as DriveClient;
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    ds = await new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
    }).initialize();
    await ds.query(
      `CREATE TABLE amb_acm_user(usr_id uuid PRIMARY KEY,ent_id uuid,usr_name text,usr_status text,usr_role text); CREATE TABLE amb_acm_user_permission(ent_id uuid,usr_id uuid,upr_permission text);`,
    );
    await ds.query(
      readFileSync(
        resolve(__dirname, '../../../../sql/acm/1032-project-drive.sql'),
        'utf8',
      ),
    );
    await ds.query(
      readFileSync(
        resolve(__dirname, '../../../../sql/acm/1032-project-drive.sql'),
        'utf8',
      ),
    );
    for (const u of [owner, member, outsider])
      await ds.query(`INSERT INTO amb_acm_user VALUES($1,$2,$3,'ACTIVE',$4)`, [
        u.id,
        u.entId,
        u.id,
        u.role,
      ]);
    await ds.query(
      `INSERT INTO amb_acm_user_permission VALUES($1,$2,'CONFIG_ADMIN')`,
      [ent, owner.id],
    );
    projects = new ProjectService(ds);
    drive = new ProjectDriveService(
      projects,
      google,
      new AesGcmService(new ConfigService({ ACM_PII_KEY: 'ab'.repeat(32) })),
    );
  });
  afterAll(async () => {
    await ds?.destroy();
    await container?.stop();
  });
  it('creates without proposal and validates tenant membership', async () => {
    await expect(
      projects.save(owner, {
        title: 'Denied',
        ownerId: owner.id,
        memberIds: [outsider.id],
      }),
    ).rejects.toThrow();
    const p = await projects.save(owner, {
      title: 'Test project',
      ownerId: owner.id,
      memberIds: [member.id],
    });
    projectId = p.prj_id;
    expect(p.prj_status).toBe('ACTIVE');
    expect((await projects.list(member)).length).toBe(1);
    await expect(projects.access(outsider, projectId)).rejects.toThrow();
    expect((await projects.list(outsider)).length).toBe(0);
  });
  it('only project owner edits members, members can write issues', async () => {
    await expect(
      projects.save(
        member,
        { title: 'take over', ownerId: member.id, memberIds: [] },
        projectId,
      ),
    ).rejects.toThrow();
    await expect(
      projects.saveItem(member, projectId, {
        kind: 'ISSUE',
        title: 'Wrong assignee',
        assigneeId: outsider.id,
      }),
    ).rejects.toThrow();
    await projects.saveItem(member, projectId, {
      kind: 'ISSUE',
      title: 'Task',
      assigneeId: member.id,
    });
    expect((await projects.items(owner, projectId)).length).toBe(1);
  });
  it('rejects unauthorized OAuth and limits redirects', async () => {
    await expect(drive.connect(member, '/admin/projects')).rejects.toThrow();
    const result = await drive.connect(owner, 'https://evil.example');
    const url = new URL(result.url);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const state = url.searchParams.get('state')!;
    await expect(
      drive.callback(state, undefined, 'different-browser'),
    ).rejects.toThrow();
    expect(await drive.callback(state, undefined, state)).toBe(
      '/admin/config/drive?drive=cancelled',
    );
    await expect(drive.callback(state, undefined, state)).rejects.toThrow();
    expect(safeReturn('//evil.example')).toBe('/admin/config/drive');
  });
  it('deduplicates Google creates and never retries uncertain create blindly', async () => {
    const create = jest.mocked(google.create),
      list = jest.mocked(google.list);
    const file = {
      id: 'drive-test',
      name: 'Doc',
      mimeType: 'application/vnd.google-apps.document',
    };
    create.mockResolvedValue(file);
    const operation = randomUUID();
    await drive.once(ent, projectId, operation, 'token', { name: 'Doc' });
    await drive.once(ent, projectId, operation, 'token', { name: 'Doc' });
    expect(create).toHaveBeenCalledTimes(1);
    await expect(
      drive.once(otherEnt, projectId, operation, 'token', { name: 'Doc' }),
    ).rejects.toThrow();
    await expect(
      drive.once(ent, projectId, operation, 'token', { name: 'Changed' }),
    ).rejects.toThrow();
    create.mockRejectedValueOnce(new Error('timeout'));
    const uncertain = randomUUID();
    await expect(
      drive.once(ent, projectId, uncertain, 'token', { name: 'Uncertain' }),
    ).rejects.toThrow();
    await expect(
      drive.once(ent, projectId, uncertain, 'token', { name: 'Uncertain' }),
    ).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(2);
    await ds.query(
      `UPDATE amb_acm_prj_operation SET created_at=now()-interval '2 minutes' WHERE pop_id=$1`,
      [uncertain],
    );
    list.mockResolvedValueOnce({ files: [file] });
    expect(
      (
        await drive.once(ent, projectId, uncertain, 'token', {
          name: 'Uncertain',
        })
      ).id,
    ).toBe('drive-test');
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('allows a retry only when Google definitively rejected the write', async () => {
    const create = jest.mocked(google.create);
    create.mockRejectedValueOnce(new DriveWriteRejected('Denied'));
    const op = randomUUID();
    await expect(
      drive.once(ent, projectId, op, 'token', { name: 'Retry' }),
    ).rejects.toThrow();
    create.mockResolvedValueOnce({
      id: 'retry-success',
      name: 'Retry',
      mimeType: 'application/pdf',
    });
    expect(
      (await drive.once(ent, projectId, op, 'token', { name: 'Retry' })).id,
    ).toBe('retry-success');
  });
  it('stores OAuth refresh tokens encrypted and rejects expired/revoked states', async () => {
    const token = jest.mocked(google.token);
    token.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'secret-refresh',
    });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          sub: 'account',
          email: 'academy@example.invalid',
          email_verified: true,
        }),
        { status: 200 },
      ),
    );
    try {
      const result = await drive.connect(owner, '/admin/projects');
      const state = new URL(result.url).searchParams.get('state')!;
      expect(await drive.callback(state, 'code', state)).toBe(
        '/admin/projects?drive=connected',
      );
      const [saved] = await ds.query(
        'SELECT * FROM amb_acm_prj_drive WHERE ent_id=$1',
        [ent],
      );
      expect(saved.token_encrypted.toString()).not.toContain('secret-refresh');
      expect((await drive.status(owner)).email).toBe('academy@example.invalid');
      expect(JSON.stringify(await drive.status(member))).not.toContain(
        'secret-refresh',
      );
      const again = await drive.connect(owner, '/admin/projects');
      await ds.query(
        "UPDATE amb_acm_prj_oauth SET expires_at=now()-interval '1 minute'",
      );
      await expect(
        drive.callback(
          new URL(again.url).searchParams.get('state')!,
          'code',
          new URL(again.url).searchParams.get('state')!,
        ),
      ).rejects.toThrow();
      const revoked = await drive.connect(owner, '/admin/projects');
      await ds.query('DELETE FROM amb_acm_user_permission WHERE usr_id=$1', [
        owner.id,
      ]);
      await expect(
        drive.callback(
          new URL(revoked.url).searchParams.get('state')!,
          'code',
          new URL(revoked.url).searchParams.get('state')!,
        ),
      ).rejects.toThrow();
      await ds.query(
        "INSERT INTO amb_acm_user_permission VALUES($1,$2,'CONFIG_ADMIN')",
        [ent, owner.id],
      );
    } finally {
      fetchMock.mockRestore();
    }
  });
  it('prevents a participant from browsing or linking outside the project folder', async () => {
    await ds.query(
      "UPDATE amb_acm_prj_project SET drive_folder_id='project-root',drive_account_id='account' WHERE prj_id=$1",
      [projectId],
    );
    jest.mocked(google.file).mockResolvedValue({
      id: 'outside',
      name: 'Private',
      mimeType: 'application/pdf',
      parents: ['unrelated-root'],
    });
    await expect(drive.link(member, projectId, 'outside')).rejects.toThrow();
    await expect(drive.browse(member, projectId, 'outside')).rejects.toThrow();
    jest.mocked(google.file).mockResolvedValue({
      id: 'inside',
      name: 'Shared',
      mimeType: 'application/pdf',
      parents: ['project-root'],
    });
    await drive.link(member, projectId, 'inside');
    expect(
      (await projects.items(member, projectId)).some(
        (i) => i.drive_file_id === 'inside',
      ),
    ).toBe(true);
  });
  it('retains references on disconnect and refuses unauthorized disconnect', async () => {
    await expect(drive.disconnect(member)).rejects.toThrow();
    await drive.disconnect(owner);
    expect((await drive.status(owner)).connected).toBe(false);
    expect(
      (await projects.items(owner, projectId)).some(
        (i) => i.drive_file_id === 'inside',
      ),
    ).toBe(true);
  });
  it('unlink preserves Google original and archive prevents writes', async () => {
    await drive.record(
      owner,
      projectId,
      {
        id: 'file-1',
        name: 'Test sheet',
        mimeType: 'application/vnd.google-apps.spreadsheet',
      },
      'account',
    );
    const items = (await projects.items(owner, projectId)) as {
      pit_id: string;
      drive_file_id: string;
    }[];
    const file = items.find((i) => i.drive_file_id === 'file-1')!;
    await projects.unlink(member, projectId, file.pit_id);
    const [stored] = await ds.query(
      'SELECT deleted_at FROM amb_acm_prj_item WHERE pit_id=$1',
      [file.pit_id],
    );
    expect(stored.deleted_at).not.toBeNull();
    await projects.save(
      owner,
      {
        title: 'Archived',
        ownerId: owner.id,
        memberIds: [member.id],
        status: 'ARCHIVED',
      },
      projectId,
    );
    await expect(
      projects.saveItem(member, projectId, { kind: 'NOTE', title: 'Blocked' }),
    ).rejects.toThrow();
    expect(await projects.access(member, projectId)).toBeDefined();
  });
});
