import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useScope } from "../project-page";

/** REQ-261015C — AMA 간소화 모드 이슈 모델 (백엔드 issue.dto.ts 와 동일). */
export const ISSUE_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "REJECTED"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
/** REQ-261016D — 업무요청(TASK) · 기타(OTHER) 2종. */
export const ISSUE_TYPES = ["TASK", "OTHER"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];
export const PRIORITIES = [1, 2, 3, 4, 5] as const;
export const TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  OPEN: ["IN_PROGRESS", "DONE", "REJECTED"],
  IN_PROGRESS: ["DONE", "OPEN"],
  DONE: ["OPEN"],
  REJECTED: ["OPEN"],
};
export const ISSUE_SORTS = [
  "created_desc",
  "updated_desc",
  "due_asc",
  "due_desc",
  "priority_asc",
] as const;

export const STATUS_BADGE: Record<IssueStatus, string> = {
  OPEN: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  DONE: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
};
export const PRIORITY_BADGE: Record<number, string> = {
  1: "text-rose-700",
  2: "text-orange-600",
  3: "text-secondary",
  4: "text-slate-500",
  5: "text-slate-400",
};

export interface Issue {
  pit_id: string;
  prj_id: string;
  prj_title: string;
  prj_status: string;
  pit_title: string;
  pit_body: string;
  pit_status: IssueStatus;
  pit_issue_type: IssueType;
  pit_priority: number;
  assignee_id: string | null;
  assignee_name: string | null;
  created_by: string;
  creator_name: string | null;
  start_date: string | null;
  due_date: string | null;
  pit_done_at: string | null;
  created_at: string;
  updated_at: string;
  // REQ-261016C
  pit_ref_no: number | null;
  pit_parent_id: string | null;
  parent_title: string | null;
  parent_ref_no: number | null;
  pit_done_ratio: number;
  pit_resolution: string;
  assigned_at: string | null;
  pit_source: string | null;
  pit_source_ref: string | null;
  participant_ids: string[];
}
export interface IssueAttachment {
  pia_id: string;
  file_item_id: string | null;
  pia_url: string | null;
  pia_name: string;
  pia_size: number | string | null;
  file_available: boolean;
}
export interface IssueDetail extends Issue {
  can_manage: boolean;
  members: { id: string; name: string; email?: string }[];
  attachments: IssueAttachment[];
}

/** 화면 번호 ISS-n (AMA ref 번호 자리). */
export const refLabel = (n: number | null | undefined) => (n ? `ISS-${n}` : "");
/** 이전 출처 표시: 'TPI01#ISN-8' → 'ISN-8' */
export const sourceRef = (i: Pick<Issue, "pit_source_ref">) =>
  i.pit_source_ref?.split("#").pop() ?? "";

/** AMA 이슈 유형 칩 색 (IssueFormModal 상위 이슈 목록과 동일). */
export const TYPE_CHIP: Record<IssueType, string> = {
  TASK: "bg-green-100 text-green-700",
  OTHER: "bg-gray-100 text-gray-700",
};
export interface IssueComment {
  pic_id: string;
  author_id: string;
  author_name: string | null;
  pic_body: string;
  created_at: string;
  updated_at: string;
}
export interface IssueStatusLog {
  psl_id: string;
  /** REQ-261016D — 상태 변경 / 담당자 변경 */
  psl_kind: "STATUS" | "ASSIGNEE";
  from_status: IssueStatus | null;
  to_status: IssueStatus | null;
  from_user_name: string | null;
  to_user_name: string | null;
  psl_note: string;
  changed_by_name: string | null;
  created_at: string;
}

export const issueBase = "/acm/prj";
/** YYYY-MM-DD (DATE 컬럼은 문자열 또는 ISO 로 온다). */
export const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

export function useIssue(id: string | undefined) {
  const scope = useScope();
  return useQuery({
    enabled: !!id,
    queryKey: ["prj", "issue", id, ...scope],
    queryFn: async () =>
      (await apiClient.get<IssueDetail>(`${issueBase}/issues/${id}`)).data,
  });
}
