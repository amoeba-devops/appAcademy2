import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * REQ-261112F — 프로젝트 타임라인. 이미 저장 중인 기록만 모은다(DB 변경 없음).
 * CREATE=이슈 생성, STATUS/ASSIGNEE/PROJECT=이슈 이력, COMMENT=코멘트, DOCUMENT=문서·파일 등록.
 */
export const TIMELINE_KINDS = [
  'CREATE',
  'STATUS',
  'ASSIGNEE',
  'PROJECT',
  'COMMENT',
  'DOCUMENT',
] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export class ProjectTimelineQuery {
  /** REQ-261112G — 전체 타임라인(/admin/issues)에서 프로젝트 하나로 좁히기 */
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsIn(TIMELINE_KINDS) kind?: TimelineKind;
  /** 커서: 이전 페이지 마지막 항목의 at·eid */
  @IsOptional() @IsISO8601() before?: string;
  @IsOptional() @IsString() @MaxLength(80) beforeId?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export interface TimelineRow {
  kind: TimelineKind;
  eid: string;
  at: string | Date;
  /** 커서용 UTC ISO(마이크로초) — 밀리초로 자르면 같은 ms 항목을 건너뛴다 */
  cursor_at: string;
  pit_id: string;
  prj_id: string;
  prj_title: string;
  pit_title: string;
  pit_ref_no: number | null;
  pit_kind: string;
  document_type: string | null;
  actor_name: string | null;
  from_status: string | null;
  to_status: string | null;
  from_user_name: string | null;
  to_user_name: string | null;
  note: string | null;
  body: string | null;
}

/**
 * 대상 프로젝트. $2=prj_id(단일, 접근 확인은 서비스에서) | NULL=접근 가능한 전체.
 * 전체 = 소유·참여 프로젝트, 서비스 관리자($8)는 모두. 삭제된 프로젝트는 제외(REQ-261112G).
 */
const PROJECTS = `
  SELECT p.prj_id,p.prj_title FROM amb_acm_prj_project p
   WHERE p.ent_id=$1 AND p.prj_deleted_at IS NULL
     AND (($2::uuid IS NOT NULL AND p.prj_id=$2::uuid)
       OR ($2::uuid IS NULL AND ($8::boolean OR p.owner_id=$7::uuid
           OR EXISTS(SELECT 1 FROM amb_acm_prj_member m WHERE m.ent_id=p.ent_id AND m.prj_id=p.prj_id AND m.usr_id=$7::uuid))))`;

/** 이벤트 원본(UNION ALL). $1=ent_id, 대상 프로젝트 = prj CTE. 삭제된 이슈·문서·코멘트는 제외. */
const EVENTS = `
  SELECT 'CREATE'::text AS kind,'c:'||i.pit_id AS eid,i.created_at AS at,i.created_by AS actor_id,i.pit_id,
         NULL::varchar AS from_status,NULL::varchar AS to_status,NULL::uuid AS from_user_id,NULL::uuid AS to_user_id,
         NULL::text AS note,NULL::text AS body
    FROM amb_acm_prj_item i
   WHERE i.ent_id=$1 AND i.prj_id IN (SELECT prj_id FROM prj) AND i.deleted_at IS NULL AND i.pit_kind='ISSUE'
  UNION ALL
  SELECT 'DOCUMENT','d:'||i.pit_id,i.created_at,i.created_by,i.pit_id,NULL,NULL,NULL,NULL,NULL,NULL
    FROM amb_acm_prj_item i
   WHERE i.ent_id=$1 AND i.prj_id IN (SELECT prj_id FROM prj) AND i.deleted_at IS NULL AND i.pit_kind<>'ISSUE'
  UNION ALL
  SELECT l.psl_kind,'l:'||l.psl_id,l.created_at,l.changed_by,l.pit_id,l.from_status,l.to_status,l.from_user_id,l.to_user_id,
         NULLIF(l.psl_note,''),NULL
    FROM amb_acm_prj_issue_status_log l
    JOIN amb_acm_prj_item i ON i.ent_id=l.ent_id AND i.pit_id=l.pit_id
   WHERE l.ent_id=$1 AND i.prj_id IN (SELECT prj_id FROM prj) AND i.deleted_at IS NULL
  UNION ALL
  SELECT 'COMMENT','m:'||c.pic_id,c.created_at,c.author_id,c.pit_id,NULL,NULL,NULL,NULL,NULL,left(c.pic_body,2000)
    FROM amb_acm_prj_issue_comment c
    JOIN amb_acm_prj_item i ON i.ent_id=c.ent_id AND i.pit_id=c.pit_id
   WHERE c.ent_id=$1 AND i.prj_id IN (SELECT prj_id FROM prj) AND i.deleted_at IS NULL AND c.deleted_at IS NULL`;

/** 최신순 한 페이지. $3=kind|null, $4=before|null, $5=beforeId, $6=limit+1, $7=user, $8=operator */
export const TIMELINE_SQL = `
  WITH prj AS (${PROJECTS}), ev AS (${EVENTS})
  SELECT e.kind,e.eid,e.at,to_char(e.at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at,e.pit_id,
         i.prj_id,pr.prj_title,i.pit_title,i.pit_ref_no,i.pit_kind,i.document_type,
         ua.usr_name AS actor_name,e.from_status,e.to_status,fu.usr_name AS from_user_name,tu.usr_name AS to_user_name,
         e.note,e.body
    FROM ev e
    JOIN amb_acm_prj_item i ON i.ent_id=$1 AND i.pit_id=e.pit_id
    JOIN prj pr ON pr.prj_id=i.prj_id
    LEFT JOIN amb_acm_user ua ON ua.ent_id=$1 AND ua.usr_id=e.actor_id
    LEFT JOIN amb_acm_user fu ON fu.ent_id=$1 AND fu.usr_id=e.from_user_id
    LEFT JOIN amb_acm_user tu ON tu.ent_id=$1 AND tu.usr_id=e.to_user_id
   WHERE ($3::text IS NULL OR e.kind=$3::text)
     AND ($4::timestamptz IS NULL OR (e.at,e.eid) < ($4::timestamptz,$5::text))
   ORDER BY e.at DESC,e.eid DESC
   LIMIT $6`;

export const TIMELINE_DEFAULT_LIMIT = 30;

/** 쿼리 → SQL 파라미터. 커서는 before·beforeId 를 같이 보내야 한다. */
export function timelineParams(
  scope: {
    entId: string;
    /** 단일 프로젝트(접근 확인 끝난 값) 또는 null=접근 가능한 전체 */
    prjId: string | null;
    userId: string;
    operator: boolean;
  },
  q: ProjectTimelineQuery,
) {
  if (!!q.before !== !!q.beforeId)
    throw new BadRequestException('잘못된 커서입니다.');
  const limit = Math.min(50, Math.max(1, q.limit ?? TIMELINE_DEFAULT_LIMIT));
  return {
    limit,
    params: [
      scope.entId,
      scope.prjId,
      q.kind ?? null,
      q.before ?? null,
      q.beforeId ?? '',
      limit + 1,
      scope.userId,
      scope.operator,
    ],
  };
}

/** limit+1 건 조회 결과 → 화면 한 페이지 + 다음 커서 */
export function timelinePage(rows: TimelineRow[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    next:
      rows.length > limit && last
        ? {
            before: last.cursor_at,
            beforeId: last.eid,
          }
        : null,
  };
}
