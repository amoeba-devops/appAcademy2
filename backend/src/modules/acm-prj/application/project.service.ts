import { ProjectRelationDto, DocumentDto } from './document.dto';
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
  can_manage?: boolean;
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
      `SELECT p.*,(p.owner_id=$3 OR EXISTS(SELECT 1 FROM amb_acm_prj_member manager WHERE manager.ent_id=p.ent_id AND manager.prj_id=p.prj_id AND manager.usr_id=$3 AND manager.member_role='MANAGER')) AS can_manage FROM amb_acm_prj_project p WHERE ent_id=$1 AND prj_id=$2 AND (owner_id=$3 OR EXISTS(SELECT 1 FROM amb_acm_prj_member m WHERE m.ent_id=p.ent_id AND m.prj_id=p.prj_id AND m.usr_id=$3))`,
      [u.entId, id, u.id],
    );
    if (!p) throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
    if (manage && !p.can_manage)
      throw new ForbiddenException('프로젝트 담당자만 관리할 수 있습니다.');
    if (write && p.prj_status === 'ARCHIVED')
      throw new BadRequestException('보관된 프로젝트는 수정할 수 없습니다.');
    return p;
  }
  async itemWrite(u: AcmCurrentUser, id: string, item: string) {
    const p = await this.access(u, id, false, true);
    const [row] = await this.ds.query<{ viewer_ids: string[] }[]>(
      'SELECT viewer_ids FROM amb_acm_prj_item WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$3 AND deleted_at IS NULL',
      [u.entId, id, item],
    );
    if (!row) throw new NotFoundException();
    if (!p.can_manage && row.viewer_ids.includes(u.id))
      throw new ForbiddenException('읽기 전용 문서입니다.');
  }
  async permissions(
    u: AcmCurrentUser,
    id: string,
    item: string,
    viewers: string[],
  ) {
    const p = await this.access(u, id, true, true);
    if (viewers.includes(p.owner_id))
      throw new BadRequestException(
        '프로젝트 담당자는 편집 권한을 유지해야 합니다.',
      );
    const members = await this.ds.query<{ usr_id: string }[]>(
      'SELECT usr_id FROM amb_acm_prj_member WHERE ent_id=$1 AND prj_id=$2',
      [u.entId, id],
    );
    if (viewers.some((v) => !members.some((m) => m.usr_id === v)))
      throw new BadRequestException('프로젝트 참여자만 지정할 수 있습니다.');
    const rows = await this.ds.query<{ pit_id: string }[]>(
      `UPDATE amb_acm_prj_item SET viewer_ids=$4,updated_at=now() WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$3 AND pit_kind<>'ISSUE' AND deleted_at IS NULL RETURNING pit_id`,
      [u.entId, id, item, viewers],
    );
    if (!rows.length) throw new NotFoundException();
    return { ok: true };
  }
  async allDocuments(u: AcmCurrentUser) {
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT i.*,p.prj_title,u.usr_name AS creator_name FROM amb_acm_prj_item i JOIN amb_acm_prj_project p ON p.ent_id=i.ent_id AND p.prj_id=i.prj_id LEFT JOIN amb_acm_user u ON u.ent_id=i.ent_id AND u.usr_id=i.created_by WHERE i.ent_id=$1 AND i.deleted_at IS NULL AND i.pit_kind<>'ISSUE' AND (p.owner_id=$2 OR EXISTS(SELECT 1 FROM amb_acm_prj_member m WHERE m.ent_id=p.ent_id AND m.prj_id=p.prj_id AND m.usr_id=$2)) ORDER BY i.updated_at DESC LIMIT 1000`,
      [u.entId, u.id],
    );
  }
  async relations(u: AcmCurrentUser, id: string) {
    await this.access(u, id);
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT r.* FROM amb_acm_prj_relation r WHERE r.ent_id=$1 AND r.prj_id=$2 AND (r.prr_kind='CLIENT' OR EXISTS(SELECT 1 FROM amb_acm_talk_member m JOIN amb_acm_talk_channel c ON c.ent_id=m.ent_id AND c.tlc_id=m.tlc_id WHERE m.ent_id=$1 AND m.tlc_id=r.ref_id AND m.tlm_kind='USER' AND m.tlm_ref_id=$3 AND m.tlm_left_at IS NULL AND c.deleted_at IS NULL)) ORDER BY r.created_at`,
      [u.entId, id, u.id],
    );
  }
  async relation(u: AcmCurrentUser, id: string, d: ProjectRelationDto) {
    await this.access(u, id, true, true);
    let name = d.name.trim();
    if (!name) throw new BadRequestException('이름을 입력하세요.');
    if (d.kind === 'CHAT') {
      const [channel] = await this.ds.query<{ tlc_name: string }[]>(
        `SELECT c.tlc_name FROM amb_acm_talk_channel c JOIN amb_acm_talk_member m ON m.ent_id=c.ent_id AND m.tlc_id=c.tlc_id WHERE c.ent_id=$1 AND c.tlc_id=$2 AND c.deleted_at IS NULL AND m.tlm_kind='USER' AND m.tlm_ref_id=$3 AND m.tlm_left_at IS NULL`,
        [u.entId, d.refId, u.id],
      );
      if (!channel)
        throw new ForbiddenException('참여 중인 채팅방만 연결할 수 있습니다.');
      name = channel.tlc_name;
    }
    return this.ds.query<Record<string, unknown>[]>(
      `INSERT INTO amb_acm_prj_relation(ent_id,prj_id,prr_kind,prr_name,ref_id) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [u.entId, id, d.kind, name, d.kind === 'CHAT' ? d.refId : null],
    );
  }
  async removeRelation(u: AcmCurrentUser, id: string, relation: string) {
    await this.access(u, id, true, true);
    await this.ds.query(
      'DELETE FROM amb_acm_prj_relation WHERE ent_id=$1 AND prj_id=$2 AND prr_id=$3',
      [u.entId, id, relation],
    );
    return { ok: true };
  }
  async people(u: AcmCurrentUser) {
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT usr_id AS id,usr_name AS name,usr_email AS email FROM amb_acm_user WHERE ent_id=$1 AND usr_status='ACTIVE' AND usr_role IN ('ADMIN','STAFF','TEACHER','APP_ADMIN') ORDER BY usr_name`,
      [u.entId],
    );
  }
  async list(u: AcmCurrentUser) {
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT p.*,(p.owner_id=$2 OR EXISTS(SELECT 1 FROM amb_acm_prj_member manager WHERE manager.ent_id=p.ent_id AND manager.prj_id=p.prj_id AND manager.usr_id=$2 AND manager.member_role='MANAGER')) AS can_manage, (SELECT count(*)::int FROM amb_acm_prj_member m WHERE m.ent_id=p.ent_id AND m.prj_id=p.prj_id) AS member_count, (SELECT count(*)::int FROM amb_acm_prj_item i WHERE i.ent_id=p.ent_id AND i.prj_id=p.prj_id AND i.pit_kind='ISSUE' AND i.deleted_at IS NULL) AS issue_count, (SELECT jsonb_agg(x) FROM (SELECT pit_title,pit_status FROM amb_acm_prj_item i WHERE i.ent_id=p.ent_id AND i.prj_id=p.prj_id AND pit_kind='ISSUE' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 3) x) AS recent_issues FROM amb_acm_prj_project p WHERE ent_id=$1 AND (owner_id=$2 OR EXISTS(SELECT 1 FROM amb_acm_prj_member m WHERE m.ent_id=p.ent_id AND m.prj_id=p.prj_id AND m.usr_id=$2)) ORDER BY updated_at DESC LIMIT 500`,
      [u.entId, u.id],
    );
  }
  async detail(u: AcmCurrentUser, id: string) {
    const p = await this.access(u, id);
    return {
      ...p,
      members: await this.ds.query<Record<string, unknown>[]>(
        `SELECT m.usr_id AS id,u.usr_name AS name,u.usr_email AS email,m.member_role FROM amb_acm_prj_member m JOIN amb_acm_user u ON u.ent_id=m.ent_id AND u.usr_id=m.usr_id WHERE m.ent_id=$1 AND m.prj_id=$2`,
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
      const managers = d.managerIds ?? [];
      const members = [
        ...new Set([...d.memberIds, ...managers, d.ownerId, u.id]),
      ];
      await this.membersValid(m, u, members);
      const [p] = id
        ? await m.query<Project[]>(
            `WITH changed AS (UPDATE amb_acm_prj_project SET prj_title=$3,prj_description=$4,owner_id=$5,prj_status=$6,updated_at=now() WHERE ent_id=$1 AND prj_id=$2 AND (owner_id=$7 OR EXISTS(SELECT 1 FROM amb_acm_prj_member m WHERE m.ent_id=$1 AND m.prj_id=$2 AND m.usr_id=$7 AND m.member_role='MANAGER')) RETURNING *) SELECT * FROM changed`,
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
      await m.query(
        "UPDATE amb_acm_prj_member SET member_role='MANAGER' WHERE ent_id=$1 AND prj_id=$2 AND usr_id=ANY($3::uuid[])",
        [u.entId, p.prj_id, managers],
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
    if (itemId) await this.itemWrite(u, id, itemId);
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
    if (itemId) await this.itemWrite(u, id, itemId);
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
    await this.itemWrite(u, id, item);
    await this.ds.query<Record<string, unknown>[]>(
      `UPDATE amb_acm_prj_item SET deleted_at=now(),updated_at=now() WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$3 AND pit_kind IN ('FILE','DOCUMENT') AND deleted_at IS NULL`,
      [u.entId, id, item],
    );
    return { ok: true };
  }
}
