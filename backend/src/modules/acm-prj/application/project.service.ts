import { DocumentDto } from './document.dto';
import { googleUrl, validateContent } from './document-content';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { ProjectDto, ItemDto } from './project.dto';
export interface Project {
  prj_id: string;
  ent_id: string;
  prj_title: string;
  prj_description: string;
  prj_status: string;
  owner_id: string;
  drive_folder_id: string | null;
  drive_account_id: string | null;
}
@Injectable()
export class ProjectService {
  constructor(@InjectDataSource(ACM_DS) readonly ds: DataSource) {}
  async access(
    u: AcmCurrentUser,
    id: string,
    manage = false,
    write = false,
  ): Promise<Project> {
    const [p] = await this.ds.query<Project[]>(
      `SELECT p.* FROM amb_acm_prj_project p WHERE ent_id=$1 AND prj_id=$2 AND (owner_id=$3 OR EXISTS(SELECT 1 FROM amb_acm_prj_member m WHERE m.ent_id=p.ent_id AND m.prj_id=p.prj_id AND m.usr_id=$3))`,
      [u.entId, id, u.id],
    );
    if (!p) throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
    if (manage && p.owner_id !== u.id)
      throw new ForbiddenException('프로젝트 담당자만 관리할 수 있습니다.');
    if (write && p.prj_status === 'ARCHIVED')
      throw new BadRequestException('보관된 프로젝트는 수정할 수 없습니다.');
    return p;
  }
  async people(u: AcmCurrentUser) {
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT usr_id AS id,usr_name AS name FROM amb_acm_user WHERE ent_id=$1 AND usr_status='ACTIVE' AND usr_role IN ('ADMIN','STAFF','TEACHER','APP_ADMIN') ORDER BY usr_name`,
      [u.entId],
    );
  }
  async list(u: AcmCurrentUser) {
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT p.*, (SELECT count(*)::int FROM amb_acm_prj_member m WHERE m.ent_id=p.ent_id AND m.prj_id=p.prj_id) AS member_count, (SELECT count(*)::int FROM amb_acm_prj_item i WHERE i.ent_id=p.ent_id AND i.prj_id=p.prj_id AND i.pit_kind='ISSUE' AND i.deleted_at IS NULL) AS issue_count, (SELECT jsonb_agg(x) FROM (SELECT pit_title,pit_status FROM amb_acm_prj_item i WHERE i.ent_id=p.ent_id AND i.prj_id=p.prj_id AND pit_kind='ISSUE' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 3) x) AS recent_issues FROM amb_acm_prj_project p WHERE ent_id=$1 AND (owner_id=$2 OR EXISTS(SELECT 1 FROM amb_acm_prj_member m WHERE m.ent_id=p.ent_id AND m.prj_id=p.prj_id AND m.usr_id=$2)) ORDER BY updated_at DESC LIMIT 500`,
      [u.entId, u.id],
    );
  }
  async detail(u: AcmCurrentUser, id: string) {
    const p = await this.access(u, id);
    return {
      ...p,
      members: await this.ds.query<Record<string, unknown>[]>(
        `SELECT m.usr_id AS id,u.usr_name AS name FROM amb_acm_prj_member m JOIN amb_acm_user u ON u.ent_id=m.ent_id AND u.usr_id=m.usr_id WHERE m.ent_id=$1 AND m.prj_id=$2`,
        [u.entId, id],
      ),
    };
  }
  async membersValid(m: EntityManager, u: AcmCurrentUser, ids: string[]) {
    const rows = await m.query<{ usr_id: string }[]>(
      `SELECT usr_id FROM amb_acm_user WHERE ent_id=$1 AND usr_id=ANY($2::uuid[]) AND usr_status='ACTIVE' AND usr_role IN ('ADMIN','STAFF','TEACHER','APP_ADMIN')`,
      [u.entId, ids],
    );
    if (rows.length !== ids.length)
      throw new BadRequestException(
        '학원 소속 활성 사용자만 참여할 수 있습니다.',
      );
  }
  async save(u: AcmCurrentUser, d: ProjectDto, id?: string) {
    if (!d.title.trim())
      throw new BadRequestException('프로젝트명을 입력하세요.');
    if (id) await this.access(u, id, true);
    return this.ds.transaction(async (m) => {
      const members = [...new Set([...d.memberIds, d.ownerId, u.id])];
      await this.membersValid(m, u, members);
      const [p] = id
        ? await m.query<Project[]>(
            `WITH changed AS (UPDATE amb_acm_prj_project SET prj_title=$3,prj_description=$4,owner_id=$5,prj_status=$6,updated_at=now() WHERE ent_id=$1 AND prj_id=$2 AND owner_id=$7 RETURNING *) SELECT * FROM changed`,
            [
              u.entId,
              id,
              d.title.trim(),
              d.description ?? '',
              d.ownerId,
              d.status ?? 'ACTIVE',
              u.id,
            ],
          )
        : await m.query<Project[]>(
            `INSERT INTO amb_acm_prj_project(ent_id,prj_title,prj_description,owner_id) VALUES($1,$2,$3,$4) RETURNING *`,
            [u.entId, d.title.trim(), d.description ?? '', d.ownerId],
          );
      if (!p) throw new ForbiddenException();
      await m.query<Record<string, unknown>[]>(
        `DELETE FROM amb_acm_prj_member WHERE ent_id=$1 AND prj_id=$2`,
        [u.entId, p.prj_id],
      );
      await m.query<Record<string, unknown>[]>(
        `INSERT INTO amb_acm_prj_member(ent_id,prj_id,usr_id) SELECT $1,$2,unnest($3::uuid[])`,
        [u.entId, p.prj_id, members],
      );
      return p;
    });
  }
  async items(u: AcmCurrentUser, id: string) {
    await this.access(u, id);
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT i.*,u.usr_name AS creator_name FROM amb_acm_prj_item i LEFT JOIN amb_acm_user u ON u.ent_id=i.ent_id AND u.usr_id=i.created_by WHERE i.ent_id=$1 AND prj_id=$2 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1000`,
      [u.entId, id],
    );
  }
  async saveItem(u: AcmCurrentUser, id: string, d: ItemDto, itemId?: string) {
    await this.access(u, id, false, true);
    if (!d.title.trim()) throw new BadRequestException('제목을 입력하세요.');
    if (d.assigneeId) {
      const [m] = await this.ds.query<Record<string, unknown>[]>(
        `SELECT 1 FROM amb_acm_prj_member WHERE ent_id=$1 AND prj_id=$2 AND usr_id=$3`,
        [u.entId, id, d.assigneeId],
      );
      if (!m) throw new BadRequestException('프로젝트 참여자를 선택하세요.');
    }
    const values = [
      u.entId,
      id,
      d.title.trim(),
      d.body ?? '',
      d.status ?? 'TODO',
      d.assigneeId ?? null,
      d.dueDate ?? null,
    ];
    const [row] = itemId
      ? await this.ds.query<Record<string, unknown>[]>(
          `WITH changed AS (UPDATE amb_acm_prj_item SET pit_title=$3,pit_body=$4,pit_status=$5,assignee_id=$6,due_date=$7,updated_at=now() WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$8 AND pit_kind=$9 AND content IS NULL AND deleted_at IS NULL RETURNING *) SELECT * FROM changed`,
          [...values, itemId, d.kind],
        )
      : await this.ds.query<Record<string, unknown>[]>(
          `INSERT INTO amb_acm_prj_item(ent_id,prj_id,pit_title,pit_body,pit_status,assignee_id,due_date,pit_kind,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [...values, d.kind, u.id],
        );
    if (!row) throw new NotFoundException();
    await this.ds.query(
      `UPDATE amb_acm_prj_project SET updated_at=now() WHERE ent_id=$1 AND prj_id=$2`,
      [u.entId, id],
    );
    return row;
  }
  async saveDocument(
    u: AcmCurrentUser,
    id: string,
    d: DocumentDto,
    itemId?: string,
  ) {
    await this.access(u, id, false, true);
    if (!d.title.trim()) throw new BadRequestException('제목을 입력하세요.');
    const content =
      d.storageType === 'LOCAL'
        ? validateContent(d.content, d.documentType)
        : null;
    const url =
      d.storageType === 'GOOGLE_LINK'
        ? googleUrl(d.url ?? '', d.documentType)
        : null;
    const kind = d.documentType === 'MEMO' ? 'NOTE' : 'DOCUMENT';
    const values = [
      u.entId,
      id,
      d.title.trim(),
      kind,
      d.documentType,
      d.storageType,
      content ? JSON.stringify(content) : null,
      url,
    ];
    const [row] = itemId
      ? await this.ds.query<Record<string, unknown>[]>(
          `WITH changed AS (UPDATE amb_acm_prj_item SET pit_title=$3,content=$7,external_url=$8,pit_body='',revision=revision+1,updated_at=now() WHERE ent_id=$1 AND prj_id=$2 AND pit_kind=$4 AND document_type=$5 AND storage_type=$6 AND pit_id=$9 AND revision=$10 AND deleted_at IS NULL RETURNING *) SELECT * FROM changed`,
          [...values, itemId, d.revision],
        )
      : await this.ds.query<Record<string, unknown>[]>(
          `INSERT INTO amb_acm_prj_item(ent_id,prj_id,pit_title,pit_kind,document_type,storage_type,content,external_url,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [...values, u.id],
        );
    if (!row)
      throw new ConflictException(
        '문서가 변경되었거나 접근할 수 없습니다. 내용을 복사한 후 목록을 새로고침하세요.',
      );
    await this.ds.query(
      'UPDATE amb_acm_prj_project SET updated_at=now() WHERE ent_id=$1 AND prj_id=$2',
      [u.entId, id],
    );
    return row;
  }
  async unlink(u: AcmCurrentUser, id: string, item: string) {
    await this.access(u, id, false, true);
    await this.ds.query<Record<string, unknown>[]>(
      `UPDATE amb_acm_prj_item SET deleted_at=now(),updated_at=now() WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$3 AND pit_kind IN ('FILE','DOCUMENT') AND deleted_at IS NULL`,
      [u.entId, id, item],
    );
    return { ok: true };
  }
}
