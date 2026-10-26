import { hasUserPermission } from '../../acm-common/guards/config-admin.guard';
import { canDeleteRecords } from '../../acm-common/guards/tenant-master.guard';
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
import { canTransition } from './issue.dto';
import { notifyIssueMentions } from './issue-mentions';
export interface Project {
  prj_id: string;
  ent_id: string;
  prj_title: string;
  prj_description: string;
  prj_status: string;
  owner_id: string;
  can_manage?: boolean;
  is_member?: boolean;
  drive_folder_id: string | null;
  drive_account_id: string | null;
}
/** p = 프로젝트 alias, $3 = 사용자. */
const IS_MEMBER = `(p.owner_id=$3 OR EXISTS(SELECT 1 FROM amb_acm_prj_member m WHERE m.ent_id=p.ent_id AND m.prj_id=p.prj_id AND m.usr_id=$3))`;
const MANAGES = `(p.owner_id=$3 OR EXISTS(SELECT 1 FROM amb_acm_prj_member manager WHERE manager.ent_id=p.ent_id AND manager.prj_id=p.prj_id AND manager.usr_id=$3 AND manager.member_role='MANAGER'))`;
@Injectable()
export class ProjectService {
  constructor(@InjectDataSource(ACM_DS) readonly ds: DataSource) {}
  async access(
    u: AcmCurrentUser,
    id: string,
    manage = false,
    write = false,
  ): Promise<Project> {
    // PLN-261027B — 서비스 관리자는 참여하지 않은 프로젝트도 열고 관리한다.
    const [p] = await this.ds.query<Project[]>(
      `SELECT p.*,($4::boolean OR ${MANAGES}) AS can_manage,${IS_MEMBER} AS is_member FROM amb_acm_prj_project p WHERE p.ent_id=$1 AND p.prj_id=$2 AND p.prj_deleted_at IS NULL AND ($4::boolean OR ${IS_MEMBER})`,
      [u.entId, id, u.id, await this.isOperator(u)],
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
      `SELECT i.*,(p.prj_status<>'ARCHIVED' AND (i.created_by=$2 OR p.owner_id=$2 OR $3::boolean OR EXISTS(SELECT 1 FROM amb_acm_prj_member mg WHERE mg.ent_id=p.ent_id AND mg.prj_id=p.prj_id AND mg.usr_id=$2 AND mg.member_role='MANAGER'))) AS can_delete,p.prj_title,p.drive_folder_id AS prj_drive_folder_id,p.drive_folder_name AS prj_drive_folder_name,(SELECT d.root_name FROM amb_acm_prj_drive d WHERE d.ent_id=p.ent_id) AS drive_root_name,u.usr_name AS creator_name FROM amb_acm_prj_item i JOIN amb_acm_prj_project p ON p.ent_id=i.ent_id AND p.prj_id=i.prj_id LEFT JOIN amb_acm_user u ON u.ent_id=i.ent_id AND u.usr_id=i.created_by WHERE i.ent_id=$1 AND i.deleted_at IS NULL AND p.prj_deleted_at IS NULL AND i.pit_kind<>'ISSUE' AND (p.owner_id=$2 OR EXISTS(SELECT 1 FROM amb_acm_prj_member m WHERE m.ent_id=p.ent_id AND m.prj_id=p.prj_id AND m.usr_id=$2)) ORDER BY i.updated_at DESC LIMIT 1000`,
      [u.entId, u.id, await this.isTenantMaster(u)],
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
      `SELECT p.*,($2::boolean OR ${MANAGES}) AS can_manage,${IS_MEMBER} AS is_member, (SELECT count(*)::int FROM amb_acm_prj_member m WHERE m.ent_id=p.ent_id AND m.prj_id=p.prj_id) AS member_count, (SELECT count(*)::int FROM amb_acm_prj_item i WHERE i.ent_id=p.ent_id AND i.prj_id=p.prj_id AND i.pit_kind='ISSUE' AND i.deleted_at IS NULL) AS issue_count, (SELECT jsonb_agg(x) FROM (SELECT pit_title,pit_status FROM amb_acm_prj_item i WHERE i.ent_id=p.ent_id AND i.prj_id=p.prj_id AND pit_kind='ISSUE' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 3) x) AS recent_issues FROM amb_acm_prj_project p WHERE p.ent_id=$1 AND p.prj_deleted_at IS NULL AND ($2::boolean OR ${IS_MEMBER}) ORDER BY p.updated_at DESC LIMIT 500`,
      [u.entId, await this.isOperator(u), u.id],
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
    const operator = await this.isOperator(u);
    const before = id ? await this.access(u, id, true) : undefined;
    return this.ds.transaction(async (m) => {
      const managers = d.managerIds ?? [];
      // PLN-261027B — 참여하지 않은 서비스 관리자가 수정해도 참여자로 넣지 않는다.
      const self = before && !before.is_member && operator ? [] : [u.id];
      const members = [
        ...new Set([...d.memberIds, ...managers, d.ownerId, ...self]),
      ];
      await this.membersValid(m, u, members);
      const [p] = id
        ? await m.query<Project[]>(
            `WITH changed AS (UPDATE amb_acm_prj_project SET prj_title=$3,prj_description=$4,owner_id=$5,prj_status=$6,updated_at=now() WHERE ent_id=$1 AND prj_id=$2 AND prj_deleted_at IS NULL AND ($8::boolean OR owner_id=$7 OR EXISTS(SELECT 1 FROM amb_acm_prj_member m WHERE m.ent_id=$1 AND m.prj_id=$2 AND m.usr_id=$7 AND m.member_role='MANAGER')) RETURNING *) SELECT * FROM changed`,
            [
              u.entId,
              id,
              d.title.trim(),
              d.description ?? '',
              d.ownerId,
              d.status ?? 'ACTIVE',
              u.id,
              operator,
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
    const p = await this.access(u, id);
    // REQ-261019 — 목록 삭제 버튼: 작성자·프로젝트 소유자/담당자·테넌트 마스터(이슈 제외)
    const master = !!p.can_manage || (await this.isTenantMaster(u));
    const archived = p.prj_status === 'ARCHIVED';
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT i.*,(NOT $5::boolean AND i.pit_kind<>'ISSUE' AND (i.created_by=$3 OR $4::boolean)) AS can_delete,u.usr_name AS creator_name FROM amb_acm_prj_item i LEFT JOIN amb_acm_user u ON u.ent_id=i.ent_id AND u.usr_id=i.created_by WHERE i.ent_id=$1 AND prj_id=$2 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1000`,
      [u.entId, id, u.id, master, archived],
    );
  }
  private isTenantMaster(u: AcmCurrentUser) {
    return hasUserPermission(this.ds, u, 'TENANT_MASTER');
  }
  /** PLN-261027B — 서비스 관리자: 관리자 등급 + (서비스 운영자 또는 테넌트 마스터). */
  isOperator(u: AcmCurrentUser) {
    return canDeleteRecords(this.ds, u);
  }
  /** PLN-261027B — 서비스 관리자 전용 프로젝트 삭제(숨김). 이슈·문서·파일은 그대로 두고 함께 숨겨진다. */
  async remove(u: AcmCurrentUser, id: string) {
    if (!(await this.isOperator(u)))
      throw new ForbiddenException(
        '서비스 관리자만 프로젝트를 삭제할 수 있습니다.',
      );
    // UPDATE … RETURNING 은 [rows, count] 로 온다.
    const [rows] = await this.ds.query<[{ prj_id: string }[], number]>(
      `UPDATE amb_acm_prj_project SET prj_deleted_at=now(),prj_deleted_by=$3,updated_at=now() WHERE ent_id=$1 AND prj_id=$2 AND prj_deleted_at IS NULL RETURNING prj_id`,
      [u.entId, id, u.id],
    );
    if (!rows.length)
      throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
    return { ok: true };
  }
  /** 삭제 확인 창에 보여줄 이슈·문서·파일 수. */
  async counts(u: AcmCurrentUser, id: string) {
    await this.access(u, id);
    const [c] = await this.ds.query<
      { issues: number; files: number; documents: number }[]
    >(
      `SELECT count(*) FILTER (WHERE pit_kind='ISSUE')::int AS issues,count(*) FILTER (WHERE pit_kind='FILE')::int AS files,count(*) FILTER (WHERE pit_kind NOT IN ('ISSUE','FILE'))::int AS documents FROM amb_acm_prj_item WHERE ent_id=$1 AND prj_id=$2 AND deleted_at IS NULL`,
      [u.entId, id],
    );
    return c;
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
    if (d.startDate && d.dueDate && d.startDate > d.dueDate)
      throw new BadRequestException('시작일은 마감일보다 늦을 수 없습니다.');
    // REQ-261015C — 이슈 상태 전이 검사 + 이력.
    let before: string | undefined;
    let prevAssignee: string | null = null;
    let prevBody = '';
    if (itemId && d.kind === 'ISSUE') {
      const [cur] = await this.ds.query<
        { pit_status: string; assignee_id: string | null; pit_body: string }[]
      >(
        `SELECT pit_status,assignee_id,pit_body FROM amb_acm_prj_item WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$3 AND pit_kind='ISSUE' AND deleted_at IS NULL`,
        [u.entId, id, itemId],
      );
      if (!cur) throw new NotFoundException();
      before = cur.pit_status;
      prevAssignee = cur.assignee_id;
      prevBody = cur.pit_body ?? '';
      // REQ-261016D — 수정 창에는 담당자 칸이 없다. 생략하면 현재 담당자를 유지한다.
      if (d.assigneeId === undefined) d = { ...d, assigneeId: prevAssignee };
      if (d.status && !canTransition(before, d.status))
        throw new BadRequestException('허용되지 않는 상태 변경입니다.');
    }
    if (d.kind === 'ISSUE') await this.checkIssueLinks(u, id, d, itemId);
    const status = d.status ?? before ?? 'OPEN';
    const values = [
      u.entId,
      id,
      d.title.trim(),
      d.body ?? '',
      status,
      d.assigneeId ?? null,
      d.dueDate ?? null,
      d.issueType ?? 'TASK',
      d.priority ?? 3,
      d.startDate ?? null,
    ];
    const row = await this.ds.transaction(async (m) => {
      const [saved] = itemId
        ? await m.query<Record<string, unknown>[]>(
            `WITH changed AS (UPDATE amb_acm_prj_item SET pit_title=$3,pit_body=$4,pit_status=$5::varchar,assignee_id=$6,due_date=$7,pit_issue_type=$8,pit_priority=$9,start_date=$10,pit_done_at=CASE WHEN $5::varchar='DONE' THEN COALESCE(pit_done_at,now()) ELSE NULL END,updated_at=now() WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$11 AND pit_kind=$12 AND content IS NULL AND deleted_at IS NULL RETURNING *) SELECT * FROM changed`,
            [...values, itemId, d.kind],
          )
        : await m.query<Record<string, unknown>[]>(
            `INSERT INTO amb_acm_prj_item(ent_id,prj_id,pit_title,pit_body,pit_status,assignee_id,due_date,pit_issue_type,pit_priority,start_date,pit_done_at,pit_kind,created_by) VALUES($1,$2,$3,$4,$5::varchar,$6,$7,$8,$9,$10,CASE WHEN $5::varchar='DONE' THEN now() END,$11,$12) RETURNING *`,
            [...values, d.kind, u.id],
          );
      if (!saved) throw new NotFoundException();
      if (d.kind === 'ISSUE')
        await this.saveIssueExtras(
          m,
          u,
          id,
          saved.pit_id as string,
          d,
          !itemId || prevAssignee !== (d.assigneeId ?? null),
        );
      // REQ-261016E — 설명에 새로 멘션된 사람에게 알림
      if (d.kind === 'ISSUE')
        await notifyIssueMentions(m, {
          entId: u.entId,
          actorId: u.id,
          issueId: saved.pit_id as string,
          before: prevBody,
          after: d.body ?? '',
        });
      if (d.kind === 'ISSUE' && before !== status)
        await m.query(
          `INSERT INTO amb_acm_prj_issue_status_log(ent_id,pit_id,from_status,to_status,changed_by) VALUES($1,$2,$3,$4,$5)`,
          [u.entId, saved.pit_id, before ?? null, status, u.id],
        );
      await m.query(
        `UPDATE amb_acm_prj_project SET updated_at=now() WHERE ent_id=$1 AND prj_id=$2`,
        [u.entId, id],
      );
      return saved;
    });
    return row;
  }
  /**
   * REQ-261016C — 상위 이슈(같은 프로젝트, 순환 금지)·참여자(프로젝트 참여자, 담당 제외) 검사.
   */
  private async checkIssueLinks(
    u: AcmCurrentUser,
    id: string,
    d: ItemDto,
    itemId?: string,
  ) {
    if (d.parentId) {
      if (d.parentId === itemId)
        throw new BadRequestException(
          '자기 자신을 상위 이슈로 지정할 수 없습니다.',
        );
      const chain = await this.ds.query<{ pit_id: string }[]>(
        `WITH RECURSIVE up AS (
           SELECT pit_id,pit_parent_id,prj_id,1 AS depth FROM amb_acm_prj_item
            WHERE ent_id=$1 AND pit_id=$2 AND pit_kind='ISSUE' AND deleted_at IS NULL
           UNION ALL
           SELECT i.pit_id,i.pit_parent_id,i.prj_id,up.depth+1 FROM amb_acm_prj_item i JOIN up ON i.pit_id=up.pit_parent_id
            WHERE i.ent_id=$1 AND up.depth<50)
         SELECT pit_id FROM up WHERE prj_id=$3`,
        [u.entId, d.parentId, id],
      );
      if (!chain.length)
        throw new BadRequestException(
          '같은 프로젝트의 이슈만 상위 이슈로 지정할 수 있습니다.',
        );
      if (itemId && chain.some((c) => c.pit_id === itemId))
        throw new BadRequestException(
          '하위 이슈를 상위 이슈로 지정할 수 없습니다.',
        );
    }
    const participants = (d.participantIds ?? []).filter(
      (p) => p !== d.assigneeId,
    );
    if (participants.length) {
      const rows = await this.ds.query<{ usr_id: string }[]>(
        `SELECT usr_id FROM amb_acm_prj_member WHERE ent_id=$1 AND prj_id=$2 AND usr_id=ANY($3::uuid[])`,
        [u.entId, id, participants],
      );
      if (rows.length !== new Set(participants).size)
        throw new BadRequestException('프로젝트 참여자만 지정할 수 있습니다.');
    }
  }
  /** 참여자·첨부·진행률·상위 이슈·해결 내용·배정 시각. 생략한 항목은 그대로 둔다. */
  private async saveIssueExtras(
    m: EntityManager,
    u: AcmCurrentUser,
    id: string,
    pitId: string,
    d: ItemDto,
    reassigned: boolean,
  ) {
    await m.query(
      `UPDATE amb_acm_prj_item SET
         pit_parent_id=CASE WHEN $3 THEN $4::uuid ELSE pit_parent_id END,
         pit_done_ratio=COALESCE($5::smallint,pit_done_ratio),
         pit_resolution=COALESCE($6::text,pit_resolution),
         assigned_at=CASE WHEN assignee_id IS NULL THEN NULL
                          WHEN assigned_at IS NULL OR $7::boolean THEN now()
                          ELSE assigned_at END
       WHERE ent_id=$1 AND pit_id=$2`,
      [
        u.entId,
        pitId,
        d.parentId !== undefined,
        d.parentId ?? null,
        d.doneRatio ?? null,
        d.resolution ?? null,
        reassigned,
      ],
    );
    if (d.participantIds) {
      const ids = [...new Set(d.participantIds)].filter(
        (p) => p !== d.assigneeId,
      );
      await m.query(
        `DELETE FROM amb_acm_prj_issue_participant WHERE ent_id=$1 AND pit_id=$2 AND NOT (usr_id=ANY($3::uuid[]))`,
        [u.entId, pitId, ids],
      );
      await m.query(
        `INSERT INTO amb_acm_prj_issue_participant(ent_id,pit_id,usr_id) SELECT $1,$2,unnest($3::uuid[]) ON CONFLICT DO NOTHING`,
        [u.entId, pitId, ids],
      );
    }
    if (d.attachments) {
      const keep: string[] = [];
      for (const a of d.attachments) {
        let fileItemId: string | null = null;
        let size: number | null = null;
        // PLN-261027B — 이미 이 이슈에 붙은 파일은 그대로 유지(다른 이슈와 함께 쓰여 원래 프로젝트에 남은 파일 포함).
        const [attached] = a.fileItemId
          ? await m.query<{ pia_id: string }[]>(
              `SELECT pia_id FROM amb_acm_prj_issue_attachment WHERE ent_id=$1 AND pit_id=$2 AND file_item_id=$3::uuid AND deleted_at IS NULL LIMIT 1`,
              [u.entId, pitId, a.fileItemId],
            )
          : [];
        if (attached) {
          keep.push(attached.pia_id);
          continue;
        }
        if (a.fileItemId || a.driveFileId) {
          const [f] = await m.query<
            { pit_id: string; drive_size: string | null }[]
          >(
            `SELECT pit_id,drive_size FROM amb_acm_prj_item WHERE ent_id=$1 AND prj_id=$2 AND deleted_at IS NULL AND (pit_id=$3::uuid OR drive_file_id=$4) LIMIT 1`,
            [u.entId, id, a.fileItemId ?? null, a.driveFileId ?? null],
          );
          if (!f)
            throw new BadRequestException('첨부 파일을 찾을 수 없습니다.');
          fileItemId = f.pit_id;
          size = f.drive_size == null ? null : Number(f.drive_size);
        } else if (!a.url) {
          throw new BadRequestException('첨부 파일 또는 URL을 지정하세요.');
        }
        const [existing] = await m.query<{ pia_id: string }[]>(
          `SELECT pia_id FROM amb_acm_prj_issue_attachment WHERE ent_id=$1 AND pit_id=$2 AND deleted_at IS NULL AND (file_item_id=$3::uuid OR (file_item_id IS NULL AND pia_url=$4)) LIMIT 1`,
          [u.entId, pitId, fileItemId, a.url ?? null],
        );
        if (existing) keep.push(existing.pia_id);
        else {
          const [row] = await m.query<{ pia_id: string }[]>(
            `INSERT INTO amb_acm_prj_issue_attachment(ent_id,pit_id,file_item_id,pia_url,pia_name,pia_size,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING pia_id`,
            [
              u.entId,
              pitId,
              fileItemId,
              fileItemId ? null : a.url,
              a.name.trim(),
              size,
              u.id,
            ],
          );
          keep.push(row.pia_id);
        }
      }
      await m.query(
        `UPDATE amb_acm_prj_issue_attachment SET deleted_at=now() WHERE ent_id=$1 AND pit_id=$2 AND deleted_at IS NULL AND NOT (pia_id=ANY($3::uuid[]))`,
        [u.entId, pitId, keep],
      );
    }
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
  /** 예전 "연결 해제" — 삭제와 같은 규칙(호환). */
  unlink(u: AcmCurrentUser, id: string, item: string) {
    return this.deleteItem(u, id, item);
  }
  /**
   * REQ-261019 — 목록에서 메모·문서·파일 삭제(소프트 삭제, Google 원본은 그대로).
   * 작성자, 프로젝트 소유자·담당자(MANAGER), 테넌트 마스터만. 보관된 프로젝트는 거부.
   */
  async deleteItem(u: AcmCurrentUser, id: string, item: string) {
    const p = await this.access(u, id, false, true);
    const [row] = await this.ds.query<{ created_by: string | null }[]>(
      `SELECT created_by FROM amb_acm_prj_item WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$3 AND pit_kind<>'ISSUE' AND deleted_at IS NULL`,
      [u.entId, id, item],
    );
    if (!row) throw new NotFoundException();
    if (
      row.created_by !== u.id &&
      !p.can_manage &&
      !(await this.isTenantMaster(u))
    )
      throw new ForbiddenException(
        '작성자나 프로젝트 담당자만 삭제할 수 있습니다.',
      );
    await this.ds.query(
      `UPDATE amb_acm_prj_item SET deleted_at=now(),updated_at=now() WHERE ent_id=$1 AND prj_id=$2 AND pit_id=$3 AND pit_kind<>'ISSUE' AND deleted_at IS NULL`,
      [u.entId, id, item],
    );
    await this.ds.query(
      'UPDATE amb_acm_prj_project SET updated_at=now() WHERE ent_id=$1 AND prj_id=$2',
      [u.entId, id],
    );
    return { ok: true };
  }
}
