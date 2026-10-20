import { Readable } from 'node:stream';
import {
  ProjectFileService,
  openTicketFile,
} from '../../../src/modules/acm-prj/application/project-file.service';
import { ObjectStoreClient } from '../../../src/modules/acm-csl/infrastructure/external/object-store.client';
import { DocAssetService } from '../../../src/modules/acm-prj/application/doc-asset.service';
import { SharedDriveService } from '../../../src/modules/acm-prj/application/shared-drive.service';
import {
  googleUrl,
  validateContent,
} from '../../../src/modules/acm-prj/application/document-content';
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
  resetDriveTokenCache,
  safeReturn,
} from '../../../src/modules/acm-prj/application/drive.service';
import {
  DriveClient,
  DriveReconnectRequired,
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
    detail: jest.fn(),
    update: jest.fn(),
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
    for (let i = 0; i < 2; i++)
      await ds.query(
        readFileSync(
          resolve(__dirname, '../../../../sql/acm/1033-project-workspace.sql'),
          'utf8',
        ),
      );
    await ds.query(
      readFileSync(
        resolve(__dirname, '../../../../sql/acm/1034-project-parity.sql'),
        'utf8',
      ),
    );
    // REQ-261016 — 회사 Workspace 연동 상태 컬럼.
    await ds.query(
      readFileSync(
        resolve(__dirname, '../../../../sql/acm/1038-drive-company-folder.sql'),
        'utf8',
      ),
    );
    // REQ-261015C — 이슈 확장(상태·유형·우선순위·댓글·이력). set_acm_updated_at 필요.
    await ds.query(`CREATE OR REPLACE FUNCTION set_acm_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;`);
    for (let i = 0; i < 2; i++)
      await ds.query(
        readFileSync(
          resolve(__dirname, '../../../../sql/acm/1036-prj-issue-extend.sql'),
          'utf8',
        ),
      );
    // REQ-261016C/D — 이슈 번호·상위·참여자·첨부, 유형·담당 이력(saveItem 이 사용).
    for (const f of [
      '1040-prj-issue-ama-parity.sql',
      '1042-prj-issue-types-assignee-log.sql',
      '1047-prj-drive-folder-name.sql',
    ])
      await ds.query(
        readFileSync(resolve(__dirname, '../../../../sql/acm/' + f), 'utf8'),
      );
    await ds.query('ALTER TABLE amb_acm_user ADD COLUMN usr_email text');
    for (const u of [owner, member, outsider])
      await ds.query(
        `INSERT INTO amb_acm_user(usr_id,ent_id,usr_name,usr_status,usr_role) VALUES($1,$2,$3,'ACTIVE',$4)`,
        [u.id, u.entId, u.id, u.role],
      );
    await ds.query(
      `INSERT INTO amb_acm_user_permission VALUES($1,$2,'CONFIG_ADMIN')`,
      [ent, owner.id],
    );
    // PLN-261020C — 문서 본문 이미지·첨부 자산.
    for (let i = 0; i < 2; i++)
      await ds.query(
        readFileSync(
          resolve(__dirname, '../../../../sql/acm/1048-prj-doc-asset.sql'),
          'utf8',
        ),
      );
    projects = new ProjectService(ds);
    drive = new ProjectDriveService(
      projects,
      google,
      new AesGcmService(new ConfigService({ ACM_PII_KEY: 'ab'.repeat(32) })),
    );
  });
  it('validates versioned workbooks and preserves legacy sheets', () => {
    const workbook = {
      version: 2,
      sheets: [
        { id: 'one', name: 'Sheet1', celldata: [{ r: 0, c: 0, v: { v: 12 } }] },
      ],
    };
    expect(validateContent(workbook, 'SHEET')).toEqual(workbook);
    expect(() =>
      validateContent(
        {
          version: 2,
          sheets: [
            { id: 'x', name: 'S', celldata: [{ r: -1, c: 0, v: { v: 1 } }] },
          ],
        },
        'SHEET',
      ),
    ).toThrow();
    expect(() =>
      validateContent(
        {
          version: 2,
          sheets: [{ id: 'x', name: 'S', celldata: [], images: [] }],
        },
        'SHEET',
      ),
    ).toThrow();
    expect(
      validateContent({ cells: [[{ value: '12' }]] }, 'SHEET'),
    ).toBeDefined();
  });
  it('blocks viewers from editing, preserves owner and hides other tenant documents', async () => {
    const p = await projects.save(owner, {
      title: 'Permissions',
      ownerId: owner.id,
      memberIds: [member.id],
    });
    const d = await projects.saveDocument(owner, p.prj_id, {
      title: 'Read me',
      documentType: 'MEMO',
      storageType: 'LOCAL',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    await projects.permissions(owner, p.prj_id, String(d.pit_id), [member.id]);
    await expect(
      projects.itemWrite(member, p.prj_id, String(d.pit_id)),
    ).rejects.toThrow();
    await expect(
      projects.itemWrite(owner, p.prj_id, String(d.pit_id)),
    ).resolves.toBeUndefined();
    await expect(
      projects.permissions(member, p.prj_id, String(d.pit_id), []),
    ).rejects.toThrow();
    await expect(
      projects.permissions(owner, p.prj_id, String(d.pit_id), [outsider.id]),
    ).rejects.toThrow();
    expect(
      (await projects.allDocuments(outsider)).some(
        (row: { pit_id: string }) => row.pit_id === d.pit_id,
      ),
    ).toBe(false);
    await ds.query('DELETE FROM amb_acm_prj_item WHERE prj_id=$1', [p.prj_id]);
    await ds.query('DELETE FROM amb_acm_prj_member WHERE prj_id=$1', [
      p.prj_id,
    ]);
    await ds.query('DELETE FROM amb_acm_prj_project WHERE prj_id=$1', [
      p.prj_id,
    ]);
  });
  it('stores document assets behind an unguessable link', async () => {
    const p = await projects.save(owner, {
      title: 'Assets',
      ownerId: owner.id,
      memberIds: [],
    });
    const store = {
      isConfigured: () => true,
      buildKey: (e: string, id: string, name: string) => `${e}/${id}/${name}`,
      putObject: jest.fn().mockResolvedValue(undefined),
      getObjectStream: jest.fn().mockImplementation(() =>
        Promise.resolve({
          stream: Readable.from([Buffer.from('png')]),
          contentLength: 3,
          partial: false,
        }),
      ),
    } as unknown as ObjectStoreClient;
    const svc = new DocAssetService(projects, store);
    const image = {
      size: 3,
      buffer: Buffer.from('png'),
      originalname: 'a.png',
      mimetype: 'image/png',
    } as Express.Multer.File;
    await expect(
      svc.upload(outsider, p.prj_id, 'image', image),
    ).rejects.toThrow();
    await expect(
      svc.upload(owner, p.prj_id, 'image', {
        ...image,
        originalname: 'a.svg',
        mimetype: 'image/svg+xml',
      }),
    ).rejects.toThrow();
    const a = await svc.upload(owner, p.prj_id, 'image', image);
    expect(a.url).toMatch(
      /^\/api\/acm\/prj\/doc-assets\/[0-9a-f-]{36}\/[\w-]{43}$/,
    );
    const [id, token] = a.url.split('/').slice(-2);
    const opened = await svc.open(id, token);
    expect(opened).toMatchObject({
      inline: true,
      mime: 'image/png',
      filename: 'a.png',
    });
    await expect(svc.open(id, token.slice(1) + 'A')).rejects.toThrow();
    const f = await svc.upload(owner, p.prj_id, 'file', {
      ...image,
      originalname: 'a.pdf',
      mimetype: 'application/pdf',
    });
    const [fid, ftoken] = f.url.split('/').slice(-2);
    expect(await svc.open(fid, ftoken)).toMatchObject({
      inline: false,
      mime: 'application/octet-stream',
    });
  });
  it('uploads local files idempotently and isolates download URLs', async () => {
    const p = await projects.save(owner, {
      title: 'Files',
      ownerId: owner.id,
      memberIds: [],
    });
    const store = {
      isConfigured: () => true,
      buildKey: (ent: string, id: string, name: string) =>
        `${ent}/${id}/${name}`,
      putObject: jest.fn().mockResolvedValue(undefined),
      presignGet: jest.fn(),
      getObjectStream: jest.fn().mockImplementation(() =>
        Promise.resolve({
          stream: Readable.from([Buffer.from('test')]),
          mime: 'application/pdf',
          contentLength: 4,
          partial: false,
        }),
      ),
    } as unknown as ObjectStoreClient;
    const svc = new ProjectFileService(
      projects,
      {
        status: async () => ({ rootReady: false }),
        projectReady: async () => false,
      } as unknown as ProjectDriveService,
      store,
    );
    const op = randomUUID();
    const dto = { title: 'example.pdf', phase: 'ETC', operationId: op };
    const file = {
      size: 4,
      buffer: Buffer.from('test'),
      originalname: 'example.pdf',
      mimetype: 'application/pdf',
    } as Express.Multer.File;
    await svc.upload(owner, p.prj_id, dto, file);
    await svc.upload(owner, p.prj_id, dto, file);
    expect(store.putObject).toHaveBeenCalledTimes(1);
    await expect(svc.download(outsider, p.prj_id, op)).rejects.toThrow();
    // REQ-261020 — 내부 MinIO 주소 대신 같은 서버의 5분 서명 링크, 내용은 서버가 스트림
    const { url } = await svc.download(owner, p.prj_id, op);
    expect(url).toMatch(/^\/api\/acm\/prj\/files\/content\?t=/);
    expect(store.presignGet).not.toHaveBeenCalled();
    const ticket = decodeURIComponent(url.split('t=')[1]);
    const opened = await openTicketFile(ds, store, ticket);
    expect(opened.filename).toBe('example.pdf');
    let body = '';
    for await (const chunk of opened.stream) body += String(chunk);
    expect(body).toBe('test');
    await expect(openTicketFile(ds, store, ticket + 'x')).rejects.toThrow();
    await projects.unlink(owner, p.prj_id, op);
    await expect(svc.download(owner, p.prj_id, op)).rejects.toThrow();
    await expect(svc.upload(owner, p.prj_id, dto, file)).rejects.toThrow();
    await ds.query('DELETE FROM amb_acm_prj_item WHERE prj_id=$1', [p.prj_id]);
    await ds.query('DELETE FROM amb_acm_prj_member WHERE prj_id=$1', [
      p.prj_id,
    ]);
    await ds.query('DELETE FROM amb_acm_prj_project WHERE prj_id=$1', [
      p.prj_id,
    ]);
  });
  it('allows assigned project managers while preserving tenant boundaries', async () => {
    const p = await projects.save(owner, {
      title: 'Managers',
      ownerId: owner.id,
      memberIds: [member.id],
      managerIds: [member.id],
    });
    expect((await projects.access(member, p.prj_id, true)).can_manage).toBe(
      true,
    );
    await projects.save(
      member,
      {
        title: 'Managed',
        ownerId: owner.id,
        memberIds: [member.id],
        managerIds: [member.id],
      },
      p.prj_id,
    );
    await expect(projects.access(outsider, p.prj_id, true)).rejects.toThrow();
    await ds.query('DELETE FROM amb_acm_prj_member WHERE prj_id=$1', [
      p.prj_id,
    ]);
    await ds.query('DELETE FROM amb_acm_prj_project WHERE prj_id=$1', [
      p.prj_id,
    ]);
  });
  it('normalizes existing Google links and rejects lookalike hosts', () => {
    expect(
      googleUrl(
        ' https://docs.google.com/spreadsheets/d/demo?usp=sharing&gid=123 ',
        'SHEET',
      ),
    ).toBe('https://docs.google.com/spreadsheets/d/demo/edit#gid=123');
    expect(
      googleUrl(
        'https://docs.google.com/document/d/demo/edit?usp=sharing',
        'DOC',
      ),
    ).toBe('https://docs.google.com/document/d/demo/edit');
    expect(() =>
      googleUrl(
        'https://docs.google.com.evil.example/document/d/demo/edit',
        'DOC',
      ),
    ).toThrow();
    expect(() =>
      googleUrl('https://user@docs.google.com/document/d/demo/edit', 'DOC'),
    ).toThrow();
    expect(() =>
      googleUrl('http://docs.google.com/document/d/demo/edit', 'DOC'),
    ).toThrow();
    expect(() =>
      googleUrl('https://docs.google.com/document/d/demo/edit', 'SHEET'),
    ).toThrow();
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
    // REQ-261016 — 일반 Gmail(hd 없음)은 거부, Workspace(hd)만 연결.
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: 'personal',
            email: 'someone@gmail.com',
            email_verified: true,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            sub: 'account',
            email: 'academy@example.invalid',
            email_verified: true,
            hd: 'example.invalid',
          }),
          { status: 200 },
        ),
      );
    try {
      const personal = await drive.connect(owner, '/admin/projects');
      expect(new URL(personal.url).searchParams.get('hd')).toBe('*');
      const personalState = new URL(personal.url).searchParams.get('state')!;
      expect(await drive.callback(personalState, 'code', personalState)).toBe(
        '/admin/projects?drive=workspace_required',
      );
      expect((await drive.status(owner)).connected).toBe(false);
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
      expect(await drive.status(owner)).toMatchObject({
        email: 'academy@example.invalid',
        domain: 'example.invalid',
        needsReconnect: false,
      });
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
  it('names the company shared folder and recovers from expired Google auth without 401', async () => {
    await ds.query(
      `CREATE TABLE IF NOT EXISTS amb_acm_tenant(tnt_ent_id uuid PRIMARY KEY, tnt_name text)`,
    );
    await ds.query(
      `INSERT INTO amb_acm_tenant VALUES($1,'Test Academy') ON CONFLICT DO NOTHING`,
      [ent],
    );
    resetDriveTokenCache();
    jest
      .mocked(google.token)
      .mockResolvedValue({ access_token: 'access', expires_in: 3600 });
    jest.mocked(google.create).mockResolvedValueOnce({
      id: 'company-root',
      name: 'ACM - Test Academy',
      mimeType: 'application/vnd.google-apps.folder',
    });
    jest.mocked(google.file).mockResolvedValue({
      id: 'company-root',
      name: 'ACM - Test Academy',
      mimeType: 'application/vnd.google-apps.folder',
      capabilities: { canAddChildren: true },
    });
    await expect(drive.root(member)).rejects.toThrow();
    await drive.root(owner);
    expect(jest.mocked(google.create).mock.lastCall?.[1]).toMatchObject({
      name: 'ACM - Test Academy',
    });
    expect(await drive.status(owner)).toMatchObject({
      rootReady: true,
      rootName: 'ACM - Test Academy',
    });
    // 토큰 캐시: 연속 호출에도 refresh 는 한 번.
    const calls = jest.mocked(google.token).mock.calls.length;
    await drive.token(ent);
    await drive.token(ent);
    expect(jest.mocked(google.token).mock.calls.length).toBe(calls);
    // 만료·철회 → 409(로그아웃 유발 401 아님) + 재연결 필요 표시, Drive 저장 중지.
    resetDriveTokenCache();
    jest
      .mocked(google.token)
      .mockRejectedValueOnce(new DriveReconnectRequired());
    await expect(drive.token(ent)).rejects.toMatchObject({ status: 409 });
    expect(await drive.status(owner)).toMatchObject({
      needsReconnect: true,
      rootReady: false,
    });
    await ds.query(
      'UPDATE amb_acm_prj_drive SET needs_reconnect=false WHERE ent_id=$1',
      [ent],
    );
  });
  it('lets users choose Drive or ACM storage once connected, ACM only before', async () => {
    const store = {
      isConfigured: () => true,
      buildKey: (e: string, id: string, name: string) => `${e}/${id}/${name}`,
      putObject: jest.fn().mockResolvedValue(undefined),
    } as unknown as ObjectStoreClient;
    const file = {
      size: 4,
      buffer: Buffer.from('test'),
      originalname: 'a.pdf',
      mimetype: 'application/pdf',
    } as Express.Multer.File;
    const driveCreate = jest.fn().mockResolvedValue({ id: 'drive-file' });
    const svc = (rootReady: boolean) =>
      new ProjectFileService(
        projects,
        {
          status: async () => ({ rootReady }),
          projectReady: async () => rootReady,
          create: driveCreate,
        } as unknown as ProjectDriveService,
        store,
      );
    const dto = (storage?: 'DRIVE' | 'ACM') => ({
      title: 'a.pdf',
      phase: 'ETC',
      operationId: randomUUID(),
      storage,
    });
    await expect(
      svc(false).upload(owner, projectId, dto('DRIVE'), file),
    ).rejects.toMatchObject({ status: 409 });
    await svc(false).upload(owner, projectId, dto(), file);
    expect(store.putObject).toHaveBeenCalledTimes(1);
    expect(driveCreate).not.toHaveBeenCalled();
    await svc(true).upload(owner, projectId, dto(), file);
    expect(driveCreate).toHaveBeenCalledTimes(1);
    await svc(true).upload(owner, projectId, dto('ACM'), file);
    expect(store.putObject).toHaveBeenCalledTimes(2);
    expect(driveCreate).toHaveBeenCalledTimes(1);
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
  it('preserves legacy notes and stores rich documents with optimistic revisions', async () => {
    const legacy = await projects.saveItem(owner, projectId, {
      kind: 'NOTE',
      title: 'Legacy',
      body: '<b>plain text</b>',
    });
    await ds.query(
      readFileSync(
        resolve(__dirname, '../../../../sql/acm/1033-project-workspace.sql'),
        'utf8',
      ),
    );
    const before = (await projects.items(owner, projectId)).find(
      (i) => i.pit_id === legacy.pit_id,
    )!;
    expect(before.pit_body).toBe('<b>plain text</b>');
    expect(before.document_type).toBe('MEMO');
    const d = {
      title: 'Rich',
      documentType: 'MEMO' as const,
      storageType: 'LOCAL' as const,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'hello', marks: [{ type: 'bold' }] },
            ],
          },
        ],
      },
    };
    const created = await projects.saveDocument(member, projectId, d);
    expect(created.content).toEqual(d.content);
    await projects.saveDocument(
      member,
      projectId,
      { ...d, title: 'Changed', revision: 1 },
      String(created.pit_id),
    );
    await expect(
      projects.saveDocument(
        owner,
        projectId,
        { ...d, revision: 1 },
        String(created.pit_id),
      ),
    ).rejects.toThrow('변경');
    await expect(
      projects.saveDocument(outsider, projectId, d),
    ).rejects.toThrow();
    await expect(
      projects.saveItem(
        owner,
        projectId,
        { kind: 'NOTE', title: 'Overwrite' },
        String(created.pit_id),
      ),
    ).rejects.toThrow();
  });
  it('stores local sheets and Google links without OAuth and rejects unsafe payloads', async () => {
    const sheet = {
      cells: [[{ value: '2' }, { value: '=A1*2', bold: true }]],
      widths: [120, 150],
      heights: [36],
    };
    const created = await projects.saveDocument(owner, projectId, {
      title: 'Sheet',
      documentType: 'SHEET',
      storageType: 'LOCAL',
      content: sheet,
    });
    expect(created.content).toEqual(sheet);
    const doc: { type: string; content: unknown[] } = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  attrs: {
                    colspan: 1,
                    rowspan: 1,
                    colwidth: null,
                    align: null,
                  },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '본문' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    doc.content.push({
      type: 'orderedList',
      attrs: { start: 1, type: null },
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: '목록' }] },
          ],
        },
      ],
    });
    const stored = await projects.saveDocument(owner, projectId, {
      title: 'Document table',
      documentType: 'DOC',
      storageType: 'LOCAL',
      content: doc,
    });
    expect(stored.content).toEqual(doc);
    const link = await projects.saveDocument(owner, projectId, {
      title: 'Linked',
      documentType: 'DOC',
      storageType: 'GOOGLE_LINK',
      url: 'https://docs.google.com/document/d/demo-id/edit?usp=sharing',
    });
    expect(link.external_url).toBe(
      'https://docs.google.com/document/d/demo-id/edit',
    );
    expect(() =>
      googleUrl(
        'https://docs.google.com.evil.test/document/d/demo/edit',
        'DOC',
      ),
    ).toThrow();
    expect(() =>
      googleUrl('https://docs.google.com/document/d/demo/edit', 'SHEET'),
    ).toThrow();
    expect(() =>
      validateContent(
        { type: 'doc', content: [{ type: 'image', attrs: { src: 'evil' } }] },
        'MEMO',
      ),
    ).toThrow();
    expect(() =>
      validateContent(
        {
          type: 'doc',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
        'MEMO',
      ),
    ).toThrow();
    expect(() =>
      validateContent({ cells: [[{ value: 'x' }], []] }, 'SHEET'),
    ).toThrow();
  });
  it('separates common folder ACLs, blocks private project exposure, and retains originals', async () => {
    const shared = new SharedDriveService(drive);
    jest.spyOn(drive, 'token').mockResolvedValue({
      token: 'mock',
      c: { account_id: 'account' } as Awaited<
        ReturnType<typeof drive.connection>
      >,
    });
    jest
      .spyOn(drive, 'connection')
      .mockResolvedValue({ account_id: 'account' } as Awaited<
        ReturnType<typeof drive.connection>
      >);
    jest.mocked(google.file).mockImplementation(async (_t, id) => ({
      id,
      name: id,
      mimeType: 'application/vnd.google-apps.folder',
      parents: id === 'private-project' ? ['common'] : [],
    }));
    const folder = await shared.save(owner, {
      fileId: 'common',
      operatorAccess: 'NONE',
      viewers: [member.id],
      editors: [],
    });
    expect((await shared.list(member))[0].access).toBe('VIEW');
    expect(await shared.list(outsider)).toHaveLength(0);
    await expect(
      shared.create(member, folder.drf_id, {
        title: 'Denied',
        kind: 'FOLDER',
        operationId: randomUUID(),
      }),
    ).rejects.toThrow();
    await expect(
      shared.save(member, {
        fileId: 'common',
        operatorAccess: 'EDIT',
        viewers: [],
        editors: [],
      }),
    ).rejects.toThrow();
    await ds.query(
      "UPDATE amb_acm_prj_project SET drive_folder_id='private-project',drive_account_id='account' WHERE prj_id=$1",
      [projectId],
    );
    await expect(
      shared.save(owner, {
        fileId: 'common',
        operatorAccess: 'EDIT',
        viewers: [],
        editors: [],
      }),
    ).rejects.toThrow('겹치지');
    await expect(
      shared.open(member, folder.drf_id, 'private-project'),
    ).rejects.toThrow();
    await shared.unlink(owner, folder.drf_id);
    expect(await shared.list(member)).toHaveLength(0);
    jest.restoreAllMocks();
  });
  it('REQ-261016E: rename / move / trash / search stay inside the linked folder', async () => {
    const shared = new SharedDriveService(drive);
    jest.spyOn(drive, 'token').mockResolvedValue({
      token: 'mock',
      c: { account_id: 'account' } as Awaited<
        ReturnType<typeof drive.connection>
      >,
    });
    jest
      .spyOn(drive, 'connection')
      .mockResolvedValue({ account_id: 'account' } as Awaited<
        ReturnType<typeof drive.connection>
      >);
    // root2 ─ sub ─ a.docx / root2 ─ b.pdf / outside (다른 폴더)
    const parents: Record<string, string[]> = {
      root2: [],
      sub: ['root2'],
      'a.docx': ['sub'],
      'b.pdf': ['root2'],
      outside: ['elsewhere'],
    };
    const FOLDER = 'application/vnd.google-apps.folder';
    jest.mocked(google.file).mockImplementation(async (_t, id) => ({
      id,
      name: id,
      mimeType: ['root2', 'sub'].includes(id) ? FOLDER : 'application/pdf',
      parents: parents[id] ?? [],
    }));
    const update = jest
      .mocked(google.update)
      .mockImplementation(async (_t, id) => ({ id, name: id, mimeType: 'x' }));
    const folder = await shared.save(owner, {
      fileId: 'root2',
      operatorAccess: 'NONE',
      viewers: [member.id],
      editors: [],
    });
    const id = folder.drf_id;
    // 열람 권한은 변경 불가, 최상위 폴더는 변경 불가
    await expect(shared.rename(member, id, 'a.docx', 'x')).rejects.toThrow();
    await expect(shared.rename(owner, id, 'root2', 'x')).rejects.toThrow();
    await shared.rename(owner, id, 'a.docx', ' 새 이름.docx ');
    expect(update.mock.lastCall?.slice(1, 3)).toEqual([
      'a.docx',
      { name: '새 이름.docx' },
    ]);
    // 이동: 하위 → 상위 OK, 자기 하위로는 실패, 밖의 파일은 실패
    update.mockClear();
    const moved = await shared.move(
      owner,
      id,
      ['a.docx', 'outside', 'sub'],
      'sub',
    );
    expect(moved.succeeded).toEqual(['a.docx']);
    expect(moved.failed.map((f) => f.fileId).sort()).toEqual([
      'outside',
      'sub',
    ]);
    expect(update.mock.calls[0][3]).toEqual({
      addParents: 'sub',
      removeParents: 'sub',
    });
    await expect(
      shared.move(owner, id, ['b.pdf'], 'outside'),
    ).rejects.toThrow();
    // 휴지통(영구 삭제 아님)
    update.mockClear();
    const trashed = await shared.trash(owner, id, ['b.pdf', 'outside']);
    expect(trashed).toMatchObject({ succeeded: ['b.pdf'] });
    expect(update.mock.calls[0][2]).toEqual({ trashed: true });
    // 검색: 연결 폴더 트리 안에서만
    const list = jest.mocked(google.list).mockImplementation(async (_t, q) =>
      q.includes('mimeType=')
        ? {
            files: q.includes("'root2' in parents")
              ? [{ id: 'sub', name: 'sub', mimeType: FOLDER }]
              : [],
          }
        : {
            files: [
              { id: 'a.docx', name: '보고서', mimeType: 'application/pdf' },
            ],
          },
    );
    const found = await shared.search(member, "보고'서");
    expect(found.files).toEqual([
      expect.objectContaining({ id: 'a.docx', drfId: id }),
    ]);
    const nameQuery = list.mock.calls.find((c) =>
      c[1].includes('name contains'),
    )?.[1];
    expect(nameQuery).toContain("name contains '보고\\'서'");
    expect(nameQuery).toContain("'sub' in parents");
    await expect(shared.search(member, 'a')).rejects.toThrow();
    await shared.unlink(owner, id);
    jest.restoreAllMocks();
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
    // REQ-261019 — 작성자가 아닌 일반 참여자는 삭제(연결 해제) 불가, 프로젝트 소유자는 가능
    await expect(
      projects.unlink(member, projectId, file.pit_id),
    ).rejects.toMatchObject({ status: 403 });
    const listed = (await projects.items(member, projectId)) as {
      pit_id: string;
      can_delete: boolean;
    }[];
    expect(listed.find((i) => i.pit_id === file.pit_id)?.can_delete).toBe(
      false,
    );
    await projects.unlink(owner, projectId, file.pit_id);
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
  it('REQ-261018C: stores the project folder name for the storage path and backfills old projects', async () => {
    const [row] = await ds.query<{ account_id: string }[]>(
      'SELECT account_id FROM amb_acm_prj_drive WHERE ent_id=$1',
      [ent],
    );
    const account = row?.account_id ?? 'account';
    if (!row)
      await ds.query(
        `INSERT INTO amb_acm_prj_drive(ent_id,account_id,account_email,token_encrypted,token_iv,token_auth_tag,connected_by)
         VALUES($1,$2,'a@x.com','\\x00','\\x00','\\x00',$3)`,
        [ent, account, owner.id],
      );
    await ds.query(
      'UPDATE amb_acm_prj_drive SET needs_reconnect=false, root_name=$2 WHERE ent_id=$1',
      [ent, 'TPI-New'],
    );
    await ds.query(
      "UPDATE amb_acm_prj_project SET drive_folder_id='old-folder',drive_account_id=$2,drive_folder_name=NULL WHERE prj_id=$1",
      [projectId, account],
    );
    const tokenSpy = jest
      .spyOn(drive, 'token')
      .mockResolvedValue({ token: 't', c: {} } as never);
    jest.mocked(google.file).mockResolvedValueOnce({
      id: 'old-folder',
      name: '학원운영 (abcd1234)',
      mimeType: 'application/vnd.google-apps.folder',
    } as never);
    await drive.backfillFolderNames(ent);
    const docs = await projects.allDocuments(owner);
    const [p] = await ds.query<{ drive_folder_name: string }[]>(
      'SELECT drive_folder_name FROM amb_acm_prj_project WHERE prj_id=$1',
      [projectId],
    );
    expect(p.drive_folder_name).toBe('학원운영 (abcd1234)');
    if (docs.length)
      expect(docs[0]).toMatchObject({ drive_root_name: 'TPI-New' });
    // 이미 이름이 있으면 다시 조회하지 않는다.
    jest.mocked(google.file).mockClear();
    await drive.backfillFolderNames(ent);
    expect(google.file).not.toHaveBeenCalled();
    tokenSpy.mockRestore();
  });
  it('REQ-261019: authors, project leads and tenant masters delete from lists; issues excluded', async () => {
    const [{ prj_id: pid }] = await ds.query<{ prj_id: string }[]>(
      `INSERT INTO amb_acm_prj_project(ent_id,prj_title,owner_id) VALUES($1,'삭제 테스트',$2) RETURNING prj_id`,
      [ent, owner.id],
    );
    await ds.query(
      `INSERT INTO amb_acm_prj_member(ent_id,prj_id,usr_id,member_role) VALUES($1,$2,$3,'MEMBER')`,
      [ent, pid, member.id],
    );
    const mk = async (by: string, kind = 'NOTE') =>
      (
        await ds.query<{ pit_id: string }[]>(
          `INSERT INTO amb_acm_prj_item(ent_id,prj_id,pit_title,pit_kind,created_by) VALUES($1,$2,'x',$3,$4) RETURNING pit_id`,
          [ent, pid, kind, by],
        )
      )[0].pit_id;
    const mine = await mk(member.id);
    const ownersNote = await mk(owner.id);
    const issue = await mk(member.id, 'ISSUE');
    const docs = (await projects.allDocuments(member)) as {
      pit_id: string;
      can_delete: boolean;
    }[];
    expect(docs.find((d) => d.pit_id === mine)?.can_delete).toBe(true);
    expect(docs.find((d) => d.pit_id === ownersNote)?.can_delete).toBe(false);
    await projects.deleteItem(member, pid, mine);
    await expect(
      projects.deleteItem(member, pid, ownersNote),
    ).rejects.toMatchObject({ status: 403 });
    await expect(projects.deleteItem(owner, pid, issue)).rejects.toMatchObject({
      status: 404,
    });
    // 테넌트 마스터는 참여 중인 프로젝트에서 남의 항목도 삭제
    await ds.query(
      `INSERT INTO amb_acm_user_permission VALUES($1,$2,'TENANT_MASTER')`,
      [ent, member.id],
    );
    expect(
      (
        (await projects.items(member, pid)) as {
          pit_id: string;
          can_delete: boolean;
        }[]
      ).find((i) => i.pit_id === ownersNote)?.can_delete,
    ).toBe(true);
    await projects.deleteItem(member, pid, ownersNote);
    const left = await ds.query<{ n: number }[]>(
      `SELECT count(*)::int n FROM amb_acm_prj_item WHERE prj_id=$1 AND deleted_at IS NULL`,
      [pid],
    );
    expect(left[0].n).toBe(1); // 이슈만 남음
    await ds.query(
      `DELETE FROM amb_acm_user_permission WHERE usr_id=$1 AND upr_permission='TENANT_MASTER'`,
      [member.id],
    );
  });
});
