import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { hasConfigPermission } from '../../acm-common/guards/config-admin.guard';
import { ProjectDriveService } from './drive.service';
import { SharedFolderDto } from './document.dto';
import { CreateDriveDto } from './project.dto';
import type { GoogleFile } from '../infrastructure/drive.client';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
/** 일괄 작업 결과(AMA 와 같은 모양). */
export interface BulkResult {
  succeeded: string[];
  failed: { fileId: string; reason: string }[];
}
const reason = (e: unknown) =>
  (e as { message?: string })?.message ??
  'Google Drive 요청을 완료하지 못했습니다.';
export interface Folder {
  drf_id: string;
  file_id: string;
  account_id: string;
  title: string;
  access: string;
}
@Injectable()
export class SharedDriveService {
  constructor(readonly drive: ProjectDriveService) {}
  /** 검색용 폴더 트리 캐시(5분). key = entId:drfId */
  private readonly trees = new Map<string, { at: number; ids: string[] }>();
  get ds() {
    return this.drive.ds;
  }
  async list(u: AcmCurrentUser) {
    const admin = await hasConfigPermission(this.ds, u);
    return this.ds.query<Folder[]>(
      `SELECT f.*, CASE WHEN $3 THEN 'EDIT' WHEN m.access='EDIT' OR (usr.usr_role IN ('ADMIN','STAFF','APP_ADMIN') AND f.operator_access='EDIT') THEN 'EDIT' ELSE 'VIEW' END AS access FROM amb_acm_drv_folder f JOIN amb_acm_user usr ON usr.ent_id=f.ent_id AND usr.usr_id=$2 AND usr.usr_status='ACTIVE' LEFT JOIN amb_acm_drv_member m ON m.ent_id=f.ent_id AND m.drf_id=f.drf_id AND m.usr_id=$2 WHERE f.ent_id=$1 AND f.deleted_at IS NULL AND ($3 OR m.access IS NOT NULL OR (usr.usr_role IN ('ADMIN','STAFF','APP_ADMIN') AND f.operator_access<>'NONE')) ORDER BY f.title`,
      [u.entId, u.id, admin],
    );
  }
  async access(u: AcmCurrentUser, id: string, write = false) {
    const f = (await this.list(u)).find((f) => f.drf_id === id);
    if (!f) throw new NotFoundException('폴더를 찾을 수 없습니다.');
    if (write && f.access !== 'EDIT')
      throw new ForbiddenException('읽기 전용 폴더입니다.');
    const { token, c } = await this.drive.token(u.entId);
    if (f.account_id !== c.account_id)
      throw new ConflictException('기존 Google 계정으로 다시 연결하세요.');
    return { f, token };
  }
  async save(u: AcmCurrentUser, d: SharedFolderDto) {
    await this.drive.admin(u);
    const { token, c } = await this.drive.token(u.entId);
    const f = await this.drive.google.file(token, d.fileId);
    if (f.trashed || f.mimeType !== 'application/vnd.google-apps.folder')
      throw new BadRequestException('폴더를 선택하세요.');
    // A common folder must not include, or sit inside, any private project folder.
    const projects = await this.ds.query<{ drive_folder_id: string }[]>(
      'SELECT drive_folder_id FROM amb_acm_prj_project WHERE ent_id=$1 AND drive_account_id=$2 AND drive_folder_id IS NOT NULL',
      [u.entId, c.account_id],
    );
    for (const p of projects)
      for (const [child, parent] of [
        [p.drive_folder_id, f.id],
        [f.id, p.drive_folder_id],
      ]) {
        let related = false;
        try {
          await this.drive.descendant(token, child, parent);
          related = true;
        } catch (e) {
          if (!(e instanceof ForbiddenException)) throw e;
        }
        if (related)
          throw new BadRequestException(
            '프로젝트 폴더와 겹치지 않는 공용 폴더를 선택하세요.',
          );
      }
    return this.ds.transaction(async (m) => {
      const ids = [...new Set([...d.viewers, ...d.editors])];
      await this.drive.projects.membersValid(m, u, ids);
      const [row] = await m.query<Folder[]>(
        `INSERT INTO amb_acm_drv_folder(ent_id,file_id,account_id,title,operator_access,created_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(ent_id,account_id,file_id) WHERE deleted_at IS NULL DO UPDATE SET title=excluded.title,operator_access=excluded.operator_access,updated_at=now() RETURNING *`,
        [
          u.entId,
          f.id,
          c.account_id,
          f.name.slice(0, 200),
          d.operatorAccess,
          u.id,
        ],
      );
      await m.query(
        'DELETE FROM amb_acm_drv_member WHERE ent_id=$1 AND drf_id=$2',
        [u.entId, row.drf_id],
      );
      for (const id of ids)
        await m.query(
          'INSERT INTO amb_acm_drv_member(ent_id,drf_id,usr_id,access) VALUES($1,$2,$3,$4)',
          [u.entId, row.drf_id, id, d.editors.includes(id) ? 'EDIT' : 'VIEW'],
        );
      return row;
    });
  }
  async permissions(u: AcmCurrentUser, id: string) {
    await this.drive.admin(u);
    return this.ds.query<{ usr_id: string; access: string }[]>(
      'SELECT usr_id,access FROM amb_acm_drv_member WHERE ent_id=$1 AND drf_id=$2',
      [u.entId, id],
    );
  }
  async boundary(u: AcmCurrentUser, token: string, file: string, root: string) {
    await this.drive.descendant(token, file, root);
    const c = await this.drive.connection(u.entId);
    const projects = await this.ds.query<{ drive_folder_id: string }[]>(
      'SELECT drive_folder_id FROM amb_acm_prj_project WHERE ent_id=$1 AND drive_account_id=$2 AND drive_folder_id IS NOT NULL',
      [u.entId, c.account_id],
    );
    for (const p of projects) {
      let inside = false;
      try {
        await this.drive.descendant(token, file, p.drive_folder_id);
        inside = true;
      } catch (e) {
        if (!(e instanceof ForbiddenException)) throw e;
      }
      if (inside)
        throw new ForbiddenException(
          '프로젝트 자료는 해당 프로젝트에서 확인하세요.',
        );
    }
  }
  async browse(u: AcmCurrentUser, id: string, parent?: string, page?: string) {
    const { f, token } = await this.access(u, id);
    const target = parent ?? f.file_id;
    await this.boundary(u, token, target, f.file_id);
    const result = await this.drive.google.list(
      token,
      `trashed=false and '${target}' in parents`,
      page,
    );
    const privateRoots = await this.ds.query<{ drive_folder_id: string }[]>(
      'SELECT drive_folder_id FROM amb_acm_prj_project WHERE ent_id=$1 AND drive_account_id=$2',
      [u.entId, f.account_id],
    );
    return {
      ...result,
      files: result.files.filter(
        (x) => !privateRoots.some((p) => p.drive_folder_id === x.id),
      ),
      rootId: f.file_id,
    };
  }
  async create(
    u: AcmCurrentUser,
    id: string,
    d: CreateDriveDto,
    upload?: Express.Multer.File,
  ) {
    const { f, token } = await this.access(u, id, true);
    const parent = d.parentId ?? f.file_id;
    await this.boundary(u, token, parent, f.file_id);
    if (!d.title.trim()) throw new BadRequestException('이름을 입력하세요.');
    return this.drive.once(
      u.entId,
      null,
      d.operationId,
      token,
      {
        name: d.title.trim(),
        mimeType: upload
          ? 'application/octet-stream'
          : d.kind === 'FOLDER'
            ? 'application/vnd.google-apps.folder'
            : d.kind === 'SHEET'
              ? 'application/vnd.google-apps.spreadsheet'
              : 'application/vnd.google-apps.document',
        parents: [parent],
      },
      upload,
    );
  }
  async open(u: AcmCurrentUser, id: string, file: string) {
    const { f, token } = await this.access(u, id);
    await this.boundary(u, token, file, f.file_id);
    const item = await this.drive.google.file(token, file);
    if (item.trashed) throw new NotFoundException();
    return {
      url: `https://drive.google.com/file/d/${encodeURIComponent(file)}/view`,
    };
  }
  // ── REQ-261016E — AMA /drive 와 같은 파일 작업 ──

  /** 연결 폴더 자체는 이름 변경·이동·휴지통 대상이 아니다. */
  private async writable(u: AcmCurrentUser, id: string, file: string) {
    const { f, token } = await this.access(u, id, true);
    if (file === f.file_id)
      throw new BadRequestException('연결된 최상위 폴더는 변경할 수 없습니다.');
    await this.boundary(u, token, file, f.file_id);
    return { f, token };
  }
  async detail(u: AcmCurrentUser, id: string, file: string) {
    const { f, token } = await this.access(u, id);
    await this.boundary(u, token, file, f.file_id);
    const item = await this.drive.google.detail(token, file);
    if (item.trashed) throw new NotFoundException();
    return item;
  }
  async rename(u: AcmCurrentUser, id: string, file: string, name: string) {
    if (!name.trim()) throw new BadRequestException('이름을 입력하세요.');
    const { token } = await this.writable(u, id, file);
    return this.drive.google.update(token, file, { name: name.trim() });
  }
  /** 같은 연결 폴더 안으로만 이동. 폴더를 자기 하위로 옮길 수 없다. */
  async move(
    u: AcmCurrentUser,
    id: string,
    fileIds: string[],
    target: string,
  ): Promise<BulkResult> {
    const { f, token } = await this.access(u, id, true);
    await this.boundary(u, token, target, f.file_id);
    const dest = await this.drive.google.file(token, target);
    if (dest.trashed || dest.mimeType !== FOLDER_MIME)
      throw new BadRequestException('이동할 폴더를 선택하세요.');
    const out: BulkResult = { succeeded: [], failed: [] };
    for (const file of [...new Set(fileIds)]) {
      try {
        if (file === target)
          throw new BadRequestException('같은 폴더로 이동할 수 없습니다.');
        const item = await this.writable(u, id, file).then(() =>
          this.drive.google.file(token, file),
        );
        let inside = false;
        try {
          await this.drive.descendant(token, target, file);
          inside = true;
        } catch (e) {
          if (!(e instanceof ForbiddenException)) throw e;
        }
        if (inside)
          throw new BadRequestException(
            '폴더를 자기 하위 폴더로 옮길 수 없습니다.',
          );
        await this.drive.google.update(
          token,
          file,
          {},
          {
            addParents: target,
            removeParents: (item.parents ?? []).join(','),
          },
        );
        out.succeeded.push(file);
      } catch (e) {
        out.failed.push({ fileId: file, reason: reason(e) });
      }
    }
    this.trees.delete(`${u.entId}:${id}`);
    return out;
  }
  /** Google Drive 휴지통으로 이동(영구 삭제 아님, Drive 에서 복구 가능). */
  async trash(
    u: AcmCurrentUser,
    id: string,
    fileIds: string[],
  ): Promise<BulkResult> {
    const out: BulkResult = { succeeded: [], failed: [] };
    for (const file of [...new Set(fileIds)]) {
      try {
        const { token } = await this.writable(u, id, file);
        await this.drive.google.update(token, file, { trashed: true });
        out.succeeded.push(file);
      } catch (e) {
        out.failed.push({ fileId: file, reason: reason(e) });
      }
    }
    this.trees.delete(`${u.entId}:${id}`);
    return out;
  }
  /** 연결 폴더 하위 폴더 ID(프로젝트 전용 폴더 제외). 너비 우선, 최대 500개. */
  private async folderTree(
    u: AcmCurrentUser,
    f: Folder,
    token: string,
  ): Promise<string[]> {
    const key = `${u.entId}:${f.drf_id}`;
    const hit = this.trees.get(key);
    if (hit && Date.now() - hit.at < 5 * 60_000) return hit.ids;
    const privateRoots = new Set(
      (
        await this.ds.query<{ drive_folder_id: string }[]>(
          'SELECT drive_folder_id FROM amb_acm_prj_project WHERE ent_id=$1 AND drive_account_id=$2 AND drive_folder_id IS NOT NULL',
          [u.entId, f.account_id],
        )
      ).map((p) => p.drive_folder_id),
    );
    const ids = [f.file_id];
    let level = [f.file_id];
    for (
      let depth = 0;
      depth < 10 && level.length && ids.length < 500;
      depth++
    ) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 30) {
        const parents = level
          .slice(i, i + 30)
          .map((p) => `'${p}' in parents`)
          .join(' or ');
        let page: string | undefined;
        do {
          const r = await this.drive.google.list(
            token,
            `trashed=false and mimeType='${FOLDER_MIME}' and (${parents})`,
            page,
          );
          for (const x of r.files)
            if (!privateRoots.has(x.id) && !ids.includes(x.id)) {
              ids.push(x.id);
              next.push(x.id);
            }
          page = r.nextPageToken;
        } while (page && ids.length < 500);
      }
      level = next;
    }
    this.trees.set(key, { at: Date.now(), ids });
    return ids;
  }
  /** 볼 수 있는 연결 폴더(하위 포함) 안에서 이름 검색. 최대 50건. */
  async search(u: AcmCurrentUser, q: string) {
    const text = q.trim();
    if (text.length < 2)
      throw new BadRequestException('두 글자 이상 입력하세요.');
    const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const folders = await this.list(u);
    if (!folders.length) return { files: [] };
    const { token, c } = await this.drive.token(u.entId);
    const files: (GoogleFile & { drfId: string; folderTitle: string })[] = [];
    for (const f of folders.filter((x) => x.account_id === c.account_id)) {
      const tree = await this.folderTree(u, f, token);
      for (let i = 0; i < tree.length && files.length < 50; i += 30) {
        const parents = tree
          .slice(i, i + 30)
          .map((p) => `'${p}' in parents`)
          .join(' or ');
        const r = await this.drive.google.list(
          token,
          `trashed=false and name contains '${escaped}' and (${parents})`,
        );
        for (const x of r.files)
          if (!files.some((y) => y.id === x.id))
            files.push({ ...x, drfId: f.drf_id, folderTitle: f.title });
      }
    }
    return { files: files.slice(0, 50) };
  }
  async unlink(u: AcmCurrentUser, id: string) {
    await this.drive.admin(u);
    await this.ds.query(
      'UPDATE amb_acm_drv_folder SET deleted_at=now(),updated_at=now() WHERE ent_id=$1 AND drf_id=$2',
      [u.entId, id],
    );
    return { ok: true };
  }
}
