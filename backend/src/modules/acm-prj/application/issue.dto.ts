import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** REQ-261015C — AMA 간소화 모드 이슈 상태/유형. */
export const ISSUE_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'DONE',
  'REJECTED',
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
/** REQ-261016D — 업무요청(TASK) · 기타(OTHER) 2종. */
export const ISSUE_TYPES = ['TASK', 'OTHER'] as const;
export const ISSUE_SORTS = [
  'created_desc',
  'updated_desc',
  'due_asc',
  'due_desc',
  'priority_asc',
] as const;

/** 허용 전이. 같은 상태로의 변경은 전이로 보지 않는다. */
export const ISSUE_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  OPEN: ['IN_PROGRESS', 'DONE', 'REJECTED'],
  IN_PROGRESS: ['DONE', 'OPEN'],
  DONE: ['OPEN'],
  REJECTED: ['OPEN'],
};

export function canTransition(from: string, to: string): boolean {
  if (from === to) return true;
  // 이행 전 값(TODO/DOING)은 1036 에서 변환되지만, 방어적으로 매핑한다.
  const f = (
    from === 'TODO' ? 'OPEN' : from === 'DOING' ? 'IN_PROGRESS' : from
  ) as IssueStatus;
  return ISSUE_TRANSITIONS[f]?.includes(to as IssueStatus) ?? false;
}

export class IssueListQuery {
  @IsOptional() @IsIn(['all', 'assigned', 'created']) scope?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  /** CSV */
  @IsOptional() @IsString() @MaxLength(200) types?: string;
  @IsOptional() @IsString() @MaxLength(200) statuses?: string;
  @IsOptional() @IsString() @MaxLength(50) priorities?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsIn(ISSUE_SORTS) sort?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([10, 20, 50, 100])
  limit?: number;
}
export class IssueStatusDto {
  @IsIn(ISSUE_STATUSES) status!: IssueStatus;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class IssueCommentDto {
  /** REQ-261016D — 리치 텍스트(HTML) 댓글. */
  @IsString() @MinLength(1) @MaxLength(50000) body!: string;
}

/** REQ-261016D — 담당자 지정(null = 담당 해제). */
export class IssueAssigneeDto {
  @IsOptional() @IsUUID() assigneeId?: string | null;
}

/** PLN-261027B — 이슈를 옮길 프로젝트. */
export class IssueMoveDto {
  @IsUUID() projectId!: string;
}

/** 태그·공백만 있는 HTML 은 빈 내용으로 본다. */
export const isBlankHtml = (v: string) =>
  !v
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
