import i18next from "i18next";
export interface Person {
  id: string;
  name: string;
  email?: string;
  member_role?: "MANAGER"|"MEMBER";
}
export interface Project {
  can_manage?:boolean;
  prj_code?:string;
  prj_id: string;
  prj_title: string;
  prj_description: string;
  prj_status: "ACTIVE" | "DONE" | "ARCHIVED";
  owner_id: string;
  members?: Person[];
  member_count?: number;
  issue_count?: number;
  recent_issues?: { pit_title: string; pit_status: string }[];
  drive_folder_id?: string;
  /** REQ-261018C — 저장 위치 표시용 */
  drive_folder_name?: string | null;
  updated_at: string;
}
export interface Item {
  viewer_ids?: string[];
  /** REQ-261019 — 목록 삭제 가능(작성자·프로젝트 담당자·테넌트 마스터) */
  can_delete?: boolean;
  file_phase?: string;
  download_count?:number;
  document_type?: "MEMO" | "SHEET" | "DOC" | "FILE";
  storage_type?: "LOCAL" | "GOOGLE_LINK" | "DRIVE_FILE";
  /** REQ-261018C — 문서 목록(/acm/prj/documents)의 저장 위치 */
  prj_drive_folder_id?: string | null;
  prj_drive_folder_name?: string | null;
  drive_root_name?: string | null;
  content?: unknown;
  external_url?: string;
  revision?: number;
  pit_id: string;
  pit_kind: "ISSUE" | "NOTE" | "DOCUMENT" | "FILE";
  pit_title: string;
  pit_body: string;
  pit_status: "OPEN" | "IN_PROGRESS" | "DONE" | "REJECTED";
  pit_issue_type?: "TASK" | "OTHER";
  pit_ref_no?: number | null;
  pit_priority?: number;
  start_date?: string | null;
  prj_id?: string;
  assignee_id: string | null;
  due_date: string | null;
  creator_name: string;
  drive_file_id: string | null;
  drive_mime: string | null;
  drive_size: string | null;
  created_at: string;
  updated_at: string;
}
export interface DriveStatus {
  configured: boolean;
  connected: boolean;
  canManage: boolean;
  email?: string;
  member_role?: "MANAGER"|"MEMBER";
  rootId?: string;
  rootReady: boolean;
  /** FIX-261020C — ?projectId= 로 물으면: 이 프로젝트에 Drive 로 올릴 수 있는가 */
  projectReady?: boolean;
  rootName?: string;
  // REQ-261016 — 회사 Workspace 연동 상태
  domain?: string | null;
  needsReconnect?: boolean;
  connectedAt?: string | null;
  connectedByName?: string | null;
}
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}
const STATUS_KEYS = new Set([
  "ACTIVE",
  "DONE",
  "ARCHIVED",
  "TODO",
  "DOING",
  // REQ-261015C — 이슈 간소화 모드
  "OPEN",
  "IN_PROGRESS",
  "REJECTED",
]);
/** 상태 코드 → 표시 라벨 (i18n `prj:status.*`). 알 수 없는 코드는 빈 문자열. */
export function statusName(status: string | null | undefined): string {
  return status && STATUS_KEYS.has(status)
    ? i18next.t(`prj:status.${status}`)
    : "";
}
