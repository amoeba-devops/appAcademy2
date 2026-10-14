export interface Person {
  id: string;
  name: string;
}
export interface Project {
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
  updated_at: string;
}
export interface Item {
  document_type?: "MEMO" | "SHEET" | "DOC" | "FILE";
  storage_type?: "LOCAL" | "GOOGLE_LINK" | "DRIVE_FILE";
  content?: unknown;
  external_url?: string;
  revision?: number;
  pit_id: string;
  pit_kind: "ISSUE" | "NOTE" | "DOCUMENT" | "FILE";
  pit_title: string;
  pit_body: string;
  pit_status: "TODO" | "DOING" | "DONE";
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
  rootId?: string;
  rootReady: boolean;
  rootName?: string;
}
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}
export const statusNames: Record<string, string> = {
  ACTIVE: "진행중",
  DONE: "완료",
  ARCHIVED: "보관",
  TODO: "할 일",
  DOING: "진행중",
};
