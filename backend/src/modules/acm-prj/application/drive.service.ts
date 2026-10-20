import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { hasConfigPermission } from '../../acm-common/guards/config-admin.guard';
import {
  DriveClient,
  DRIVE_SCOPE,
  DriveReconnectRequired,
  hasDriveScope,
  DriveWriteRejected,
  GoogleFile,
  googleStatusOf,
} from '../infrastructure/drive.client';
import { ProjectService } from './project.service';
import { CreateDriveDto } from './project.dto';
interface Connection {
  account_id: string;
  account_email: string;
  token_encrypted: Buffer;
  token_iv: Buffer;
  token_auth_tag: Buffer;
  root_id: string | null;
  root_name: string | null;
}
/** REQ-261016 — access token 캐시(테넌트·계정·암호문 단위). 만료 60초 전까지 재사용. */
const tokenCache = new Map<
  string,
  { key: string; token: string; expiresAt: number }
>();
/** 테스트·재연결용 캐시 초기화. */
export function resetDriveTokenCache() {
  tokenCache.clear();
}
const FOLDER = 'application/vnd.google-apps.folder';
const DOC = 'application/vnd.google-apps.document';
const SHEET = 'application/vnd.google-apps.spreadsheet';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const fixedId = (s: string) => {
  const h = hash(s);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export function safeReturn(path: string) {
  return /^\/admin\/(projects(?:\/[a-f0-9-]{36})?|drive|config\/drive)(?:\?tab=(?:issues|documents|files|notes))?$/.test(
    path,
  )
    ? path
    : '/admin/config/drive';
}
@Injectable()
export class ProjectDriveService {
  constructor(
    readonly projects: ProjectService,
    readonly google: DriveClient,
    readonly crypto: AesGcmService,
  ) {}
  get ds() {
    return this.projects.ds;
  }
  async admin(u: AcmCurrentUser) {
    if (!(await hasConfigPermission(this.ds, u)))
      throw new ForbiddenException(
        '설정 관리자만 Google 연결을 관리할 수 있습니다.',
      );
  }
  async connection(ent: string) {
    const [r] = await this.ds.query<Connection[]>(
      'SELECT * FROM amb_acm_prj_drive WHERE ent_id=$1',
      [ent],
    );
    if (!r) throw new BadRequestException('공용 Google Drive를 연결하세요.');
    return r;
  }
  async token(ent: string) {
    const c = await this.connection(ent);
    const key = `${c.account_id}:${c.token_iv.toString('base64')}`;
    const cached = tokenCache.get(ent);
    if (cached && cached.key === key && cached.expiresAt > Date.now())
      return { token: cached.token, c };
    const refresh = this.crypto.decrypt({
      ciphertext: c.token_encrypted,
      iv: c.token_iv,
      authTag: c.token_auth_tag,
    });
    try {
      const t = await this.google.token({
        grant_type: 'refresh_token',
        refresh_token: refresh,
      });
      // 예전(drive.file) 연결은 토큰은 살아 있어도 공유폴더 파일이 안 보인다 → 재연결 안내.
      if (!hasDriveScope(t.scope)) throw new DriveReconnectRequired();
      tokenCache.set(ent, {
        key,
        token: t.access_token,
        expiresAt: Date.now() + Math.max(0, (t.expires_in ?? 3600) - 60) * 1000,
      });
      return { token: t.access_token, c };
    } catch (error) {
      if (error instanceof DriveReconnectRequired) {
        tokenCache.delete(ent);
        await this.ds.query(
          'UPDATE amb_acm_prj_drive SET needs_reconnect=true,last_error_at=now() WHERE ent_id=$1',
          [ent],
        );
      }
      throw error;
    }
  }
  async status(u: AcmCurrentUser, projectId?: string) {
    const [c] = await this.ds.query<
      (Connection & {
        account_domain: string | null;
        needs_reconnect: boolean;
        updated_at: Date;
        connected_by_name: string | null;
      })[]
    >(
      `SELECT d.account_email,d.root_id,d.root_name,d.account_domain,d.needs_reconnect,d.updated_at,u.usr_name AS connected_by_name
         FROM amb_acm_prj_drive d LEFT JOIN amb_acm_user u ON u.ent_id=d.ent_id AND u.usr_id=d.connected_by
        WHERE d.ent_id=$1`,
      [u.entId],
    );
    const canManage = await hasConfigPermission(this.ds, u);
    return {
      configured: this.google.ready(),
      connected: !!c,
      email: c?.account_email,
      domain: c?.account_domain ?? null,
      needsReconnect: !!c?.needs_reconnect,
      connectedAt: c?.updated_at ?? null,
      connectedByName: c?.connected_by_name ?? null,
      rootId: canManage ? c?.root_id : undefined,
      // 재연결이 필요하면 Drive 저장을 막고 ACM 저장소만 쓰게 한다.
      rootReady: !!c?.root_id && !c?.needs_reconnect,
      rootName: c?.root_name,
      canManage,
      // FIX-261020C — 이 프로젝트에 Drive 로 올릴 수 있는가(공용폴더 또는 기존 프로젝트 폴더)
      ...(projectId
        ? { projectReady: await this.projectReady(u, projectId) }
        : {}),
    };
  }
  /**
   * FIX-261020C — 프로젝트 Drive 업로드 가능 여부.
   * 공용폴더가 있으면 가능. 없더라도 이 프로젝트가 같은 계정의 Drive 폴더를 이미 갖고 있으면 그 폴더로 올린다.
   */
  async projectReady(u: AcmCurrentUser, projectId: string) {
    const [c] = await this.ds.query<
      { account_id: string; root_id: string | null; needs_reconnect: boolean }[]
    >(
      'SELECT account_id,root_id,needs_reconnect FROM amb_acm_prj_drive WHERE ent_id=$1',
      [u.entId],
    );
    if (!c || c.needs_reconnect) return false;
    if (c.root_id) return true;
    const [p] = await this.ds.query<
      { drive_folder_id: string | null; drive_account_id: string | null }[]
    >(
      'SELECT drive_folder_id,drive_account_id FROM amb_acm_prj_project WHERE ent_id=$1 AND prj_id=$2',
      [u.entId, projectId],
    );
    return !!p?.drive_folder_id && p.drive_account_id === c.account_id;
  }
  /**
   * FIX-261020C — 연결 해제 후 같은 계정으로 다시 연결하면 공용폴더 지정이 사라진다(행 삭제).
   * 그 계정으로 만든 프로젝트 폴더의 상위 폴더를 공용폴더로 되살린다. 실패는 무시(수동 지정 가능).
   */
  async restoreRoot(entId: string, accountId: string, token: string) {
    const [c] = await this.ds.query<{ root_id: string | null }[]>(
      'SELECT root_id FROM amb_acm_prj_drive WHERE ent_id=$1 AND account_id=$2',
      [entId, accountId],
    );
    if (!c || c.root_id) return;
    const folders = await this.ds.query<{ drive_folder_id: string }[]>(
      `SELECT drive_folder_id FROM amb_acm_prj_project
        WHERE ent_id=$1 AND drive_account_id=$2 AND drive_folder_id IS NOT NULL
        ORDER BY created_at DESC LIMIT 5`,
      [entId, accountId],
    );
    for (const f of folders) {
      try {
        const parentId = (await this.google.file(token, f.drive_folder_id))
          .parents?.[0];
        if (!parentId) continue;
        const parent = await this.google.file(token, parentId);
        if (
          parent.trashed ||
          parent.mimeType !== FOLDER ||
          !parent.capabilities?.canAddChildren
        )
          continue;
        await this.ds.query(
          'UPDATE amb_acm_prj_drive SET root_id=$3,root_name=$4,updated_at=now() WHERE ent_id=$1 AND account_id=$2 AND root_id IS NULL',
          [entId, accountId, parent.id, parent.name],
        );
        return;
      } catch {
        // 폴더가 지워졌거나 권한이 없으면 다음 후보
      }
    }
  }
  async connect(u: AcmCurrentUser, path: string) {
    await this.admin(u);
    if (!this.google.ready())
      throw new BadRequestException('운영 Google OAuth 앱 설정이 필요합니다.');
    const state = randomBytes(32).toString('base64url'),
      verifier = randomBytes(32).toString('base64url');
    await this.ds.query<Record<string, unknown>[]>(
      'DELETE FROM amb_acm_prj_oauth WHERE expires_at<now() OR (ent_id=$1 AND usr_id=$2)',
      [u.entId, u.id],
    );
    await this.ds.query<Record<string, unknown>[]>(
      `INSERT INTO amb_acm_prj_oauth(ent_id,usr_id,state_hash,verifier,return_path,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')`,
      [u.entId, u.id, hash(state), verifier, safeReturn(path)],
    );
    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: this.google.setting('CLIENT_ID'), redirect_uri: this.google.setting('REDIRECT_URI'), response_type: 'code', scope: `openid email ${DRIVE_SCOPE}`, hd: '*', access_type: 'offline', prompt: 'consent select_account', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })}`,
    };
  }
  async callback(
    state: string,
    code: string | undefined,
    browserState: string,
  ) {
    if (!browserState || hash(browserState) !== hash(state))
      throw new BadRequestException(
        '연결을 시작한 브라우저에서 다시 시도하세요.',
      );
    const [s] = await this.ds.query<
      {
        ent_id: string;
        usr_id: string;
        verifier: string;
        return_path: string;
      }[]
    >(
      `WITH consumed AS (DELETE FROM amb_acm_prj_oauth WHERE state_hash=$1 AND expires_at>now() RETURNING *) SELECT * FROM consumed`,
      [hash(state)],
    );
    if (!s)
      throw new BadRequestException(
        '연결 요청이 만료되었습니다. 다시 연결하세요.',
      );
    const u = { entId: s.ent_id, id: s.usr_id };
    await this.admin(u);
    if (!code)
      return `${s.return_path}${s.return_path.includes('?') ? '&' : '?'}drive=cancelled`;
    try {
      const tokens = await this.google.token({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.google.setting('REDIRECT_URI'),
        code_verifier: s.verifier,
      });
      if (!tokens.refresh_token) throw new Error('Missing refresh token');
      // 동의 화면에서 Drive 권한 체크를 해제하면 파일을 볼 수 없다.
      if (!hasDriveScope(tokens.scope))
        return `${s.return_path}${s.return_path.includes('?') ? '&' : '?'}drive=scope_required`;
      const r = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!r.ok) throw new Error('Account check failed');
      const account = (await r.json()) as {
        sub: string;
        email: string;
        email_verified: boolean;
        hd?: string;
      };
      if (!account.sub || !account.email || !account.email_verified)
        throw new Error('Unverified account');
      // REQ-261016 — Google Workspace(회사 도메인) 계정만 허용. 일반 Gmail 은 hd 가 없다.
      if (!account.hd)
        return `${s.return_path}${s.return_path.includes('?') ? '&' : '?'}drive=workspace_required`;
      const e = this.crypto.encrypt(tokens.refresh_token);
      await this.ds.query<Record<string, unknown>[]>(
        `INSERT INTO amb_acm_prj_drive(ent_id,account_id,account_email,token_encrypted,token_iv,token_auth_tag,connected_by,account_domain) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(ent_id) DO UPDATE SET root_id=CASE WHEN amb_acm_prj_drive.account_id=excluded.account_id THEN amb_acm_prj_drive.root_id ELSE NULL END,root_name=CASE WHEN amb_acm_prj_drive.account_id=excluded.account_id THEN amb_acm_prj_drive.root_name ELSE NULL END,account_id=excluded.account_id,account_email=excluded.account_email,token_encrypted=excluded.token_encrypted,token_iv=excluded.token_iv,token_auth_tag=excluded.token_auth_tag,connected_by=excluded.connected_by,account_domain=excluded.account_domain,needs_reconnect=false,last_error_at=NULL,updated_at=now()`,
        [
          s.ent_id,
          account.sub,
          account.email,
          e.ciphertext,
          e.iv,
          e.authTag,
          s.usr_id,
          account.hd,
        ],
      );
      tokenCache.delete(s.ent_id);
      await this.restoreRoot(s.ent_id, account.sub, tokens.access_token);
      return `${s.return_path}${s.return_path.includes('?') ? '&' : '?'}drive=connected`;
    } catch {
      return `${s.return_path}${s.return_path.includes('?') ? '&' : '?'}drive=failed`;
    }
  }
  async disconnect(u: AcmCurrentUser) {
    await this.admin(u);
    tokenCache.delete(u.entId);
    await this.ds.query<Record<string, unknown>[]>(
      'DELETE FROM amb_acm_prj_drive WHERE ent_id=$1',
      [u.entId],
    );
    await this.ds.query<Record<string, unknown>[]>(
      'DELETE FROM amb_acm_prj_oauth WHERE ent_id=$1',
      [u.entId],
    );
    return { ok: true };
  }
  // Only CONFIG_ADMIN receives a short-lived token for Google's first-party Picker.
  async picker(u: AcmCurrentUser) {
    await this.admin(u);
    if (
      !this.google.setting('PICKER_KEY') ||
      !this.google.setting('PROJECT_NUMBER')
    )
      throw new BadRequestException('Google Picker 앱 설정이 필요합니다.');
    const { token } = await this.token(u.entId);
    return {
      token,
      key: this.google.setting('PICKER_KEY'),
      appId: this.google.setting('PROJECT_NUMBER'),
    };
  }
  async once(
    ent: string,
    prj: string | null,
    operationId: string,
    token: string,
    payload: Record<string, unknown>,
    upload?: Express.Multer.File,
  ): Promise<GoogleFile> {
    const fingerprint = hash(
      JSON.stringify(payload) +
        (upload ? hash(upload.buffer.toString('base64')) : ''),
    );
    const inserted = await this.ds.query<{ pop_id: string }[]>(
      `INSERT INTO amb_acm_prj_operation(pop_id,ent_id,prj_id,fingerprint) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING pop_id`,
      [operationId, ent, prj, fingerprint],
    );
    if (!inserted.length) {
      const [op] = await this.ds.query<
        {
          fingerprint: string;
          result: GoogleFile | null;
          created_at: Date;
          state: string;
        }[]
      >(
        'SELECT fingerprint,result,created_at,state FROM amb_acm_prj_operation WHERE pop_id=$1 AND ent_id=$2 AND prj_id IS NOT DISTINCT FROM $3',
        [operationId, ent, prj],
      );
      if (!op || op.fingerprint !== fingerprint)
        throw new ConflictException('다른 요청에 사용된 작업 번호입니다.');
      if (op.result) return op.result;
      if (op.state === 'REJECTED') {
        const retry = await this.ds.query<{ pop_id: string }[]>(
          `WITH claimed AS (UPDATE amb_acm_prj_operation SET state='PENDING',created_at=now(),updated_at=now() WHERE pop_id=$1 AND ent_id=$2 AND state='REJECTED' RETURNING pop_id) SELECT * FROM claimed`,
          [operationId, ent],
        );
        if (!retry.length)
          throw new ConflictException('다른 요청이 재시도 중입니다.');
      } else {
        if (Date.now() - new Date(op.created_at).getTime() < 90000)
          throw new ConflictException(
            '작업 결과를 확인 중입니다. 잠시 후 다시 시도하세요.',
          );
        const found = await this.google.list(
          token,
          `trashed=false and appProperties has { key='acmOperation' and value='${operationId}' }`,
        );
        if (found.files.length) {
          await this.ds.query<Record<string, unknown>[]>(
            'UPDATE amb_acm_prj_operation SET result=$2,state=$3,updated_at=now() WHERE pop_id=$1',
            [operationId, JSON.stringify(found.files[0]), 'DONE'],
          );
          return found.files[0];
        }
        throw new ConflictException(
          '이전 Google 요청의 결과가 불확실합니다. 중복 생성을 막기 위해 관리자 확인이 필요합니다.',
        );
      }
    }
    const metadata = {
      ...payload,
      appProperties: { acmOperation: operationId },
    };
    let file: GoogleFile;
    try {
      file = upload
        ? await this.google.upload(token, metadata, upload)
        : await this.google.create(token, metadata);
    } catch (error) {
      if (error instanceof DriveWriteRejected)
        await this.ds.query(
          `UPDATE amb_acm_prj_operation SET state='REJECTED',updated_at=now() WHERE pop_id=$1 AND ent_id=$2`,
          [operationId, ent],
        );
      throw error;
    }
    await this.ds.query<Record<string, unknown>[]>(
      'UPDATE amb_acm_prj_operation SET result=$2,state=$3,updated_at=now() WHERE pop_id=$1 AND ent_id=$4',
      [operationId, JSON.stringify(file), 'DONE', ent],
    );
    return file;
  }
  async root(u: AcmCurrentUser, fileId?: string, name?: string) {
    await this.admin(u);
    const { token, c } = await this.token(u.entId);
    let folderName = name?.trim();
    if (!fileId && !folderName) {
      // REQ-261016 — 기본 공용폴더 이름: "ACM - {테넌트명}".
      const [t] = await this.ds.query<{ tnt_name: string }[]>(
        'SELECT tnt_name FROM amb_acm_tenant WHERE tnt_ent_id=$1',
        [u.entId],
      );
      folderName = `ACM - ${t?.tnt_name ?? 'Academy'}`;
    }
    const f = fileId
      ? await this.google.file(token, fileId)
      : await this.once(
          u.entId,
          null,
          // 같은 계정·같은 이름이면 같은 작업 ID → 중복 생성 없이 재사용.
          fixedId(`root:${u.entId}:${c.account_id}:${folderName}`),
          token,
          { name: folderName, mimeType: FOLDER },
        );
    const verified = await this.google.file(token, f.id);
    if (
      verified.trashed ||
      verified.mimeType !== FOLDER ||
      !verified.capabilities?.canAddChildren
    )
      throw new BadRequestException('파일을 생성할 수 있는 폴더를 선택하세요.');
    await this.ds.query<Record<string, unknown>[]>(
      'UPDATE amb_acm_prj_drive SET root_id=$2,root_name=$3,updated_at=now() WHERE ent_id=$1 AND account_id=$4',
      [u.entId, f.id, f.name, c.account_id],
    );
    return { ok: true };
  }
  async folder(u: AcmCurrentUser, id: string, token: string, c: Connection) {
    const p = await this.projects.access(u, id, false, true);
    if (p.drive_folder_id) {
      if (p.drive_account_id !== c.account_id)
        throw new ConflictException(
          '이 프로젝트는 이전 Google 계정에 연결되어 있습니다. 기존 계정으로 다시 연결하세요.',
        );
      return p.drive_folder_id;
    }
    if (!c.root_id)
      throw new BadRequestException(
        '먼저 Google Drive 저장 위치를 선택하세요.',
      );
    const f = await this.once(
      u.entId,
      id,
      fixedId(`folder:${u.entId}:${id}:${c.account_id}`),
      token,
      {
        name: `${p.prj_title} (${id.slice(0, 8)})`,
        mimeType: FOLDER,
        parents: [c.root_id],
      },
    );
    await this.ds.query<Record<string, unknown>[]>(
      'UPDATE amb_acm_prj_project SET drive_folder_id=$3,drive_account_id=$4,drive_folder_name=$5 WHERE ent_id=$1 AND prj_id=$2 AND drive_folder_id IS NULL',
      [u.entId, id, f.id, c.account_id, f.name ?? null],
    );
    return f.id;
  }
  /**
   * REQ-261018C — 저장 위치 표시용 프로젝트 폴더 이름. 이름이 비어 있는 기존 프로젝트만 Google 에서 한 번 읽어 저장한다.
   * 실패(미연결·권한 등)는 표시만 못 할 뿐이므로 무시한다.
   */
  async backfillFolderNames(entId: string) {
    try {
      const rows = await this.ds.query<
        { prj_id: string; drive_folder_id: string }[]
      >(
        `SELECT p.prj_id, p.drive_folder_id FROM amb_acm_prj_project p
           JOIN amb_acm_prj_drive d ON d.ent_id=p.ent_id AND d.account_id=p.drive_account_id AND NOT d.needs_reconnect
          WHERE p.ent_id=$1 AND p.drive_folder_id IS NOT NULL AND p.drive_folder_name IS NULL
          LIMIT 20`,
        [entId],
      );
      if (!rows.length) return;
      const { token } = await this.token(entId);
      for (const r of rows) {
        const f = await this.google
          .file(token, r.drive_folder_id)
          .catch(() => null);
        if (f?.name)
          await this.ds.query(
            'UPDATE amb_acm_prj_project SET drive_folder_name=$3 WHERE ent_id=$1 AND prj_id=$2',
            [entId, r.prj_id, f.name],
          );
      }
    } catch {
      // 표시용 정보 — 실패해도 목록 조회는 계속한다.
    }
  }
  async descendant(token: string, id: string, root: string) {
    let current = id;
    for (let depth = 0; depth < 30; depth++) {
      if (current === root) return;
      let f: GoogleFile;
      try {
        f = await this.google.file(token, current);
      } catch (e) {
        // 상위 폴더가 연결 계정에 보이지 않으면(공유받은 폴더의 바깥) root 아래가 아니다.
        const status = googleStatusOf(e);
        if (depth > 0 && (status === 403 || status === 404)) break;
        throw e;
      }
      if (f.trashed || !f.parents?.[0]) break;
      current = f.parents[0];
    }
    throw new ForbiddenException('프로젝트 폴더 내부만 접근할 수 있습니다.');
  }
  async browse(u: AcmCurrentUser, id: string, parent?: string, page?: string) {
    const p = await this.projects.access(u, id);
    const { token, c } = await this.token(u.entId);
    if (!p.drive_folder_id) return { files: [] };
    if (p.drive_account_id !== c.account_id)
      throw new ConflictException('기존 Google 계정으로 다시 연결하세요.');
    const folder = parent ?? p.drive_folder_id;
    await this.descendant(token, folder, p.drive_folder_id);
    return {
      ...(await this.google.list(
        token,
        `trashed=false and '${folder}' in parents`,
        page,
      )),
      rootId: p.drive_folder_id,
    };
  }
  async record(u: AcmCurrentUser, id: string, f: GoogleFile, account: string) {
    const [existing] = await this.ds.query<{ pit_id: string }[]>(
      'SELECT pit_id FROM amb_acm_prj_item WHERE ent_id=$1 AND prj_id=$2 AND drive_file_id=$3 AND deleted_at IS NULL',
      [u.entId, id, f.id],
    );
    if (existing) await this.projects.itemWrite(u, id, existing.pit_id);
    if (f.trashed || f.mimeType === FOLDER)
      throw new BadRequestException('문서 또는 파일을 선택하세요.');
    return this.ds.query<Record<string, unknown>[]>(
      `INSERT INTO amb_acm_prj_item(ent_id,prj_id,pit_kind,pit_title,created_by,drive_file_id,drive_mime,drive_size,drive_account_id,document_type,storage_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $7::varchar='application/vnd.google-apps.spreadsheet' THEN 'SHEET' WHEN $7::varchar='application/vnd.google-apps.document' THEN 'DOC' ELSE 'FILE' END,'DRIVE_FILE') ON CONFLICT(ent_id,prj_id,drive_file_id) WHERE deleted_at IS NULL AND drive_file_id IS NOT NULL DO UPDATE SET pit_title=excluded.pit_title,drive_size=excluded.drive_size,updated_at=now() RETURNING *`,
      [
        u.entId,
        id,
        [DOC, SHEET].includes(f.mimeType) ? 'DOCUMENT' : 'FILE',
        f.name.slice(0, 200),
        u.id,
        f.id,
        f.mimeType,
        f.size ?? null,
        account,
      ],
    );
  }
  async link(u: AcmCurrentUser, id: string, file: string) {
    const p = await this.projects.access(u, id, false, true);
    const { token, c } = await this.token(u.entId);
    if (!(await hasConfigPermission(this.ds, u))) {
      if (!p.drive_folder_id || p.drive_account_id !== c.account_id)
        throw new ForbiddenException();
      await this.descendant(token, file, p.drive_folder_id);
    }
    const f = await this.google.file(token, file);
    return this.record(u, id, f, c.account_id);
  }
  async create(
    u: AcmCurrentUser,
    id: string,
    d: CreateDriveDto,
    upload?: Express.Multer.File,
  ) {
    await this.projects.access(u, id, false, true);
    if (!d.title.trim()) throw new BadRequestException('이름을 입력하세요.');
    const { token, c } = await this.token(u.entId);
    const root = await this.folder(u, id, token, c);
    const parent = d.parentId ?? root;
    await this.descendant(token, parent, root);
    const f = await this.once(
      u.entId,
      id,
      d.operationId,
      token,
      {
        name: d.title.trim(),
        mimeType: upload
          ? d.kind === 'SHEET'
            ? SHEET
            : 'application/octet-stream'
          : d.kind === 'FOLDER'
            ? FOLDER
            : d.kind === 'SHEET'
              ? SHEET
              : DOC,
        parents: [parent],
      },
      upload,
    );
    if (f.mimeType !== FOLDER) await this.record(u, id, f, c.account_id);
    return f;
  }
  async open(u: AcmCurrentUser, id: string, itemId: string) {
    await this.projects.access(u, id);
    const [item] = await this.ds.query<
      { drive_file_id: string; drive_account_id: string }[]
    >(
      'SELECT drive_file_id,drive_account_id FROM amb_acm_prj_item WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$3 AND deleted_at IS NULL',
      [u.entId, id, itemId],
    );
    if (!item?.drive_file_id) throw new NotFoundException();
    const { token, c } = await this.token(u.entId);
    if (item.drive_account_id !== c.account_id)
      throw new ConflictException('기존 Google 계정으로 다시 연결하세요.');
    const f = await this.google.file(token, item.drive_file_id);
    if (f.trashed) throw new NotFoundException('원본 파일이 삭제되었습니다.');
    await this.ds.query<Record<string, unknown>[]>(
      'UPDATE amb_acm_prj_item SET pit_title=$4,drive_size=$5 WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$3',
      [u.entId, id, itemId, f.name.slice(0, 200), f.size ?? null],
    );
    return {
      url: `https://drive.google.com/file/d/${encodeURIComponent(f.id)}/view`,
    };
  }
}
