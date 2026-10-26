import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import {
  canTransition,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  isBlankHtml,
  type IssueListQuery,
} from './issue.dto';
import { notifyIssueMentions } from './issue-mentions';
import { ProjectService } from './project.service';

/**
 * 접근 가능한 프로젝트(담당자 또는 참여자) 조건. p = 프로젝트 alias, $2 = 사용자.
 * PLN-261027B — 서비스 관리자(operator)는 모든 프로젝트, 삭제된 프로젝트는 누구도 안 보임.
 */
const accessible = (operator: boolean) =>
  `(p.prj_deleted_at IS NULL AND (${operator ? 'TRUE' : 'FALSE'} OR p.owner_id=$2 OR EXISTS(SELECT 1 FROM amb_acm_prj_member m WHERE m.ent_id=p.ent_id AND m.prj_id=p.prj_id AND m.usr_id=$2)))`;
const ISSUE_SELECT = `SELECT i.pit_id,i.prj_id,i.pit_title,i.pit_body,i.pit_status,i.pit_issue_type,i.pit_priority,i.assignee_id,i.created_by,i.start_date,i.due_date,i.pit_done_at,i.created_at,i.updated_at,p.prj_title,p.prj_status,a.usr_name AS assignee_name,c.usr_name AS creator_name,
    i.pit_ref_no,i.pit_parent_id,i.pit_done_ratio,i.pit_resolution,i.assigned_at,i.pit_source,i.pit_source_ref,
    pa.pit_title AS parent_title,pa.pit_ref_no AS parent_ref_no,
    COALESCE((SELECT array_agg(x.usr_id) FROM amb_acm_prj_issue_participant x WHERE x.ent_id=i.ent_id AND x.pit_id=i.pit_id),'{}') AS participant_ids
  FROM amb_acm_prj_item i
  JOIN amb_acm_prj_project p ON p.ent_id=i.ent_id AND p.prj_id=i.prj_id
  LEFT JOIN amb_acm_user a ON a.ent_id=i.ent_id AND a.usr_id=i.assignee_id
  LEFT JOIN amb_acm_user c ON c.ent_id=i.ent_id AND c.usr_id=i.created_by
  LEFT JOIN amb_acm_prj_item pa ON pa.ent_id=i.ent_id AND pa.pit_id=i.pit_parent_id AND pa.deleted_at IS NULL`;
const SORTS: Record<string, string> = {
  created_desc: 'i.created_at DESC',
  updated_desc: 'i.updated_at DESC',
  due_asc: 'i.due_date ASC NULLS LAST, i.created_at DESC',
  due_desc: 'i.due_date DESC NULLS LAST, i.created_at DESC',
  priority_asc: 'i.pit_priority ASC, i.created_at DESC',
};

function list(csv: string | undefined, allowed: readonly string[]) {
  const values = (csv ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (values.some((v) => !allowed.includes(v)))
    throw new BadRequestException('잘못된 필터 값입니다.');
  return values;
}

export interface IssueRow {
  pit_id: string;
  prj_id: string;
  pit_status: string;
  created_by: string;
  assignee_id: string | null;
  prj_status: string;
}

/** REQ-261015C WP3/WP4 — 프로젝트를 가로지르는 이슈 목록·상세·댓글·내 업무. */
@Injectable()
export class IssueService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly projects: ProjectService,
  ) {}

  async list(u: AcmCurrentUser, q: IssueListQuery) {
    const where = [
      `i.ent_id=$1`,
      `i.pit_kind='ISSUE'`,
      `i.deleted_at IS NULL`,
      accessible(await this.projects.isOperator(u)),
    ];
    const params: unknown[] = [u.entId, u.id];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (q.scope === 'assigned') where.push('i.assignee_id=$2');
    if (q.scope === 'created') where.push('i.created_by=$2');
    if (q.q?.trim()) {
      // 제목 또는 번호(ISS-12 / 12)
      const ref = /^(?:ISS-)?(\d{1,9})$/i.exec(q.q.trim())?.[1];
      params.push(
        `%${q.q.trim().replace(/[\\%_]/g, '\\$&')}%`,
        ref ? Number(ref) : null,
      );
      where.push(
        `(i.pit_title ILIKE $${params.length - 1} OR i.pit_ref_no = $${params.length}::int)`,
      );
    }
    const types = list(q.types, ISSUE_TYPES);
    if (types.length) add('i.pit_issue_type = ANY(?::text[])', types);
    const statuses = list(q.statuses, ISSUE_STATUSES);
    if (statuses.length) add('i.pit_status = ANY(?::text[])', statuses);
    const priorities = list(q.priorities, ['1', '2', '3', '4', '5']).map(
      Number,
    );
    if (priorities.length) add('i.pit_priority = ANY(?::int[])', priorities);
    if (q.projectId) add('i.prj_id = ?', q.projectId);
    if (q.assigneeId) add('i.assignee_id = ?', q.assigneeId);
    const limit = q.limit ?? 20;
    const page = q.page ?? 1;
    const order = SORTS[q.sort ?? 'created_desc'] ?? SORTS.created_desc;
    const sql = `${ISSUE_SELECT} WHERE ${where.join(' AND ')}`;
    const [{ total }] = await this.ds.query<{ total: number }[]>(
      `SELECT count(*)::int AS total FROM (${sql}) x`,
      params,
    );
    const items = await this.ds.query<Record<string, unknown>[]>(
      `${sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params,
    );
    return { items, total, page, limit };
  }

  /** 접근 가능한 이슈 1건. 없거나 비참여 프로젝트면 404. */
  private async row(u: AcmCurrentUser, id: string) {
    const [row] = await this.ds.query<(IssueRow & Record<string, unknown>)[]>(
      `${ISSUE_SELECT} WHERE i.ent_id=$1 AND i.pit_id=$3 AND i.pit_kind='ISSUE' AND i.deleted_at IS NULL AND ${accessible(await this.projects.isOperator(u))}`,
      [u.entId, u.id, id],
    );
    if (!row) throw new NotFoundException('이슈를 찾을 수 없습니다.');
    return row;
  }

  async get(u: AcmCurrentUser, id: string) {
    const issue = await this.row(u, id);
    const project = await this.projects.detail(u, issue.prj_id);
    return {
      ...issue,
      can_manage: project.can_manage,
      members: project.members,
      attachments: await this.attachments(u.entId, id),
    };
  }

  /** REQ-261016C — 첨부 목록. 파일은 프로젝트 파일 다운로드 경로로 연다. */
  private attachments(entId: string, id: string) {
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT a.pia_id,a.file_item_id,a.pia_url,a.pia_name,COALESCE(a.pia_size,f.drive_size) AS pia_size,a.created_at,
              (f.pit_id IS NOT NULL AND f.deleted_at IS NULL AND f.prj_id=i.prj_id) AS file_available
         FROM amb_acm_prj_issue_attachment a
         JOIN amb_acm_prj_item i ON i.ent_id=a.ent_id AND i.pit_id=a.pit_id
         LEFT JOIN amb_acm_prj_item f ON f.ent_id=a.ent_id AND f.pit_id=a.file_item_id
        WHERE a.ent_id=$1 AND a.pit_id=$2 AND a.deleted_at IS NULL ORDER BY a.created_at`,
      [entId, id],
    );
  }

  async changeStatus(u: AcmCurrentUser, id: string, status: string, note = '') {
    const issue = await this.row(u, id);
    if (issue.prj_status === 'ARCHIVED')
      throw new BadRequestException('보관된 프로젝트는 수정할 수 없습니다.');
    if (issue.pit_status === status) return this.row(u, id);
    if (!canTransition(issue.pit_status, status))
      throw new BadRequestException('허용되지 않는 상태 변경입니다.');
    await this.ds.transaction(async (m) => {
      await m.query(
        `UPDATE amb_acm_prj_item SET pit_status=$3::varchar,pit_done_at=CASE WHEN $3::varchar='DONE' THEN now() ELSE NULL END,updated_at=now() WHERE ent_id=$1 AND pit_id=$2`,
        [u.entId, id, status],
      );
      await m.query(
        `INSERT INTO amb_acm_prj_issue_status_log(ent_id,pit_id,from_status,to_status,psl_note,changed_by) VALUES($1,$2,$3,$4,$5,$6)`,
        [u.entId, id, issue.pit_status, status, note.trim(), u.id],
      );
    });
    return this.row(u, id);
  }

  /**
   * REQ-261016D — 담당자 지정/해제. 프로젝트 참여자만, 배정 시각 갱신, 담당 이력 기록.
   * 새 담당자가 관련자였다면 관련자에서 뺀다.
   */
  async changeAssignee(
    u: AcmCurrentUser,
    id: string,
    assigneeId: string | null,
  ) {
    const issue = await this.row(u, id);
    await this.projects.access(u, issue.prj_id, false, true);
    if (issue.assignee_id === assigneeId) return this.get(u, id);
    if (assigneeId) {
      const [m] = await this.ds.query<unknown[]>(
        `SELECT 1 FROM amb_acm_prj_member WHERE ent_id=$1 AND prj_id=$2 AND usr_id=$3`,
        [u.entId, issue.prj_id, assigneeId],
      );
      if (!m) throw new BadRequestException('프로젝트 참여자를 선택하세요.');
    }
    await this.ds.transaction(async (m) => {
      await m.query(
        `UPDATE amb_acm_prj_item SET assignee_id=$3,assigned_at=CASE WHEN $3::uuid IS NULL THEN NULL ELSE now() END,updated_at=now() WHERE ent_id=$1 AND pit_id=$2`,
        [u.entId, id, assigneeId],
      );
      if (assigneeId)
        await m.query(
          `DELETE FROM amb_acm_prj_issue_participant WHERE ent_id=$1 AND pit_id=$2 AND usr_id=$3`,
          [u.entId, id, assigneeId],
        );
      await m.query(
        `INSERT INTO amb_acm_prj_issue_status_log(ent_id,pit_id,psl_kind,from_user_id,to_user_id,changed_by) VALUES($1,$2,'ASSIGNEE',$3,$4,$5)`,
        [u.entId, id, issue.assignee_id, assigneeId, u.id],
      );
    });
    return this.get(u, id);
  }

  /**
   * PLN-261027B — 이슈를 다른 프로젝트로 옮긴다. 두 프로젝트 모두 쓸 수 있는 사람(참여자) 또는 서비스 관리자.
   * 번호·댓글·이력은 유지. 새 프로젝트 참여자가 아닌 담당자·참여자는 빼고, 상위·하위 이슈 연결은 끊고,
   * 이 이슈만 쓰는 첨부 파일은 새 프로젝트로 옮긴다. 이력에 "이전 → 새 프로젝트"를 남긴다.
   */
  async move(u: AcmCurrentUser, id: string, projectId: string) {
    const issue = await this.row(u, id);
    if (issue.prj_id === projectId) return this.get(u, id);
    const from = await this.projects.access(u, issue.prj_id, false, true);
    const to = await this.projects.access(u, projectId, false, true);
    await this.ds.transaction(async (m) => {
      const members = `(SELECT usr_id FROM amb_acm_prj_member WHERE ent_id=$1 AND prj_id=$3 UNION SELECT owner_id FROM amb_acm_prj_project WHERE ent_id=$1 AND prj_id=$3)`;
      await m.query(
        `UPDATE amb_acm_prj_item SET prj_id=$3,pit_parent_id=NULL,
           assignee_id=CASE WHEN assignee_id IN ${members} THEN assignee_id END,
           assigned_at=CASE WHEN assignee_id IN ${members} THEN assigned_at END,
           updated_at=now()
         WHERE ent_id=$1 AND pit_id=$2`,
        [u.entId, id, projectId],
      );
      await m.query(
        `UPDATE amb_acm_prj_item SET pit_parent_id=NULL,updated_at=now() WHERE ent_id=$1 AND pit_parent_id=$2`,
        [u.entId, id],
      );
      await m.query(
        `DELETE FROM amb_acm_prj_issue_participant WHERE ent_id=$1 AND pit_id=$2 AND usr_id NOT IN ${members}`,
        [u.entId, id, projectId],
      );
      // 다른 이슈도 첨부한 파일은 원래 프로젝트에 남긴다(그 이슈의 첨부가 깨지지 않게).
      await m.query(
        `UPDATE amb_acm_prj_item f SET prj_id=$3,updated_at=now()
          WHERE f.ent_id=$1 AND f.prj_id=$4 AND f.pit_kind='FILE' AND f.deleted_at IS NULL
            AND f.pit_id IN (SELECT a.file_item_id FROM amb_acm_prj_issue_attachment a WHERE a.ent_id=$1 AND a.pit_id=$2 AND a.deleted_at IS NULL)
            AND NOT EXISTS(SELECT 1 FROM amb_acm_prj_issue_attachment o WHERE o.ent_id=$1 AND o.file_item_id=f.pit_id AND o.pit_id<>$2 AND o.deleted_at IS NULL)`,
        [u.entId, id, projectId, issue.prj_id],
      );
      await m.query(
        `INSERT INTO amb_acm_prj_issue_status_log(ent_id,pit_id,psl_kind,psl_note,changed_by) VALUES($1,$2,'PROJECT',$3,$4)`,
        [
          u.entId,
          id,
          `${from.prj_title} → ${to.prj_title}`.slice(0, 500),
          u.id,
        ],
      );
      await m.query(
        `UPDATE amb_acm_prj_project SET updated_at=now() WHERE ent_id=$1 AND prj_id=ANY($2::uuid[])`,
        [u.entId, [issue.prj_id, projectId]],
      );
    });
    return this.get(u, id);
  }

  /** 삭제: 등록자 또는 프로젝트 관리자(서비스 관리자 포함). 소프트 삭제. */
  async remove(u: AcmCurrentUser, id: string) {
    const issue = await this.row(u, id);
    const project = await this.projects.access(u, issue.prj_id, false, true);
    if (issue.created_by !== u.id && !project.can_manage)
      throw new ForbiddenException(
        '등록자 또는 프로젝트 관리자만 삭제할 수 있습니다.',
      );
    await this.ds.query(
      `UPDATE amb_acm_prj_item SET deleted_at=now(),updated_at=now() WHERE ent_id=$1 AND pit_id=$2`,
      [u.entId, id],
    );
    return { ok: true };
  }

  async statusLogs(u: AcmCurrentUser, id: string) {
    await this.row(u, id);
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT l.psl_id,l.psl_kind,l.from_status,l.to_status,l.psl_note,l.created_at,u.usr_name AS changed_by_name,
              fu.usr_name AS from_user_name,tu.usr_name AS to_user_name
         FROM amb_acm_prj_issue_status_log l
         LEFT JOIN amb_acm_user u ON u.ent_id=l.ent_id AND u.usr_id=l.changed_by
         LEFT JOIN amb_acm_user fu ON fu.ent_id=l.ent_id AND fu.usr_id=l.from_user_id
         LEFT JOIN amb_acm_user tu ON tu.ent_id=l.ent_id AND tu.usr_id=l.to_user_id
        WHERE l.ent_id=$1 AND l.pit_id=$2 ORDER BY l.created_at DESC`,
      [u.entId, id],
    );
  }

  async comments(u: AcmCurrentUser, id: string) {
    await this.row(u, id);
    return this.ds.query<Record<string, unknown>[]>(
      `SELECT c.pic_id,c.author_id,c.pic_body,c.created_at,c.updated_at,u.usr_name AS author_name
         FROM amb_acm_prj_issue_comment c
         LEFT JOIN amb_acm_user u ON u.ent_id=c.ent_id AND u.usr_id=c.author_id
        WHERE c.ent_id=$1 AND c.pit_id=$2 AND c.deleted_at IS NULL ORDER BY c.created_at`,
      [u.entId, id],
    );
  }

  async addComment(u: AcmCurrentUser, id: string, body: string) {
    const issue = await this.row(u, id);
    if (issue.prj_status === 'ARCHIVED')
      throw new BadRequestException('보관된 프로젝트는 수정할 수 없습니다.');
    if (isBlankHtml(body)) throw new BadRequestException('내용을 입력하세요.');
    await this.ds.transaction(async (m) => {
      const [c] = await m.query<{ pic_id: string }[]>(
        `INSERT INTO amb_acm_prj_issue_comment(ent_id,pit_id,author_id,pic_body) VALUES($1,$2,$3,$4) RETURNING pic_id`,
        [u.entId, id, u.id, body.trim()],
      );
      // REQ-261016E — 댓글 멘션 알림
      await notifyIssueMentions(m, {
        entId: u.entId,
        actorId: u.id,
        issueId: id,
        before: '',
        after: body,
        commentId: c.pic_id,
      });
    });
    return this.comments(u, id);
  }

  /** 수정은 작성자 본인, 삭제는 작성자 또는 프로젝트 관리자. */
  async editComment(
    u: AcmCurrentUser,
    id: string,
    commentId: string,
    body: string | null,
  ) {
    const issue = await this.row(u, id);
    const [c] = await this.ds.query<{ author_id: string; pic_body: string }[]>(
      `SELECT author_id,pic_body FROM amb_acm_prj_issue_comment WHERE ent_id=$1 AND pit_id=$2 AND pic_id=$3 AND deleted_at IS NULL`,
      [u.entId, id, commentId],
    );
    if (!c) throw new NotFoundException();
    if (body === null) {
      const project = await this.projects.access(u, issue.prj_id);
      if (c.author_id !== u.id && !project.can_manage)
        throw new ForbiddenException('작성자만 삭제할 수 있습니다.');
      await this.ds.query(
        `UPDATE amb_acm_prj_issue_comment SET deleted_at=now() WHERE ent_id=$1 AND pic_id=$2`,
        [u.entId, commentId],
      );
    } else {
      if (c.author_id !== u.id)
        throw new ForbiddenException('작성자만 수정할 수 있습니다.');
      if (isBlankHtml(body))
        throw new BadRequestException('내용을 입력하세요.');
      await this.ds.transaction(async (m) => {
        await m.query(
          `UPDATE amb_acm_prj_issue_comment SET pic_body=$3 WHERE ent_id=$1 AND pic_id=$2`,
          [u.entId, commentId, body.trim()],
        );
        // 수정으로 새로 멘션된 사람에게만 알림
        await notifyIssueMentions(m, {
          entId: u.entId,
          actorId: u.id,
          issueId: id,
          before: c.pic_body,
          after: body,
          commentId,
        });
      });
    }
    return this.comments(u, id);
  }

  /**
   * 내 업무 — 내게 배정되었거나 내가 등록했거나 참여 중인 미완료 이슈 + 최근 36시간 내 완료 이슈.
   * 지연/오늘/이후 구분과 역할(담당·등록·참여)은 테넌트 타임존 기준으로 화면에서 계산한다.
   */
  async myWork(u: AcmCurrentUser) {
    return this.ds.query<Record<string, unknown>[]>(
      `${ISSUE_SELECT}
        WHERE i.ent_id=$1 AND i.pit_kind='ISSUE' AND i.deleted_at IS NULL AND ${accessible(false)}
          AND (i.assignee_id=$2 OR i.created_by=$2
               OR EXISTS(SELECT 1 FROM amb_acm_prj_issue_participant x WHERE x.ent_id=i.ent_id AND x.pit_id=i.pit_id AND x.usr_id=$2))
          AND p.prj_status<>'ARCHIVED'
          AND (i.pit_status IN ('OPEN','IN_PROGRESS')
               OR (i.pit_status='DONE' AND i.pit_done_at > now() - interval '36 hours'))
        ORDER BY i.due_date ASC NULLS LAST, i.pit_priority ASC, i.created_at DESC
        LIMIT 500`,
      [u.entId, u.id],
    );
  }
}
