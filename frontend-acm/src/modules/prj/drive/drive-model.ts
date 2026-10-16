import {
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Film,
  Folder as FolderIcon,
  Music,
  Presentation,
  type LucideIcon,
} from "lucide-react";

/** REQ-261016E — AMA /drive 와 같은 화면용 모델. */
export const driveBase = "/acm/drive/folders";
export const FOLDER_MIME = "application/vnd.google-apps.folder";
export const MAX_UPLOAD = 50 * 1024 * 1024;

export interface Folder {
  drf_id: string;
  title: string;
  file_id: string;
  operator_access: string;
  access: "VIEW" | "EDIT";
}
export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  modifiedTime?: string;
  createdTime?: string;
  owners?: { displayName?: string; emailAddress?: string }[];
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  /** 검색 결과: 소속 연결 폴더 */
  drfId?: string;
  folderTitle?: string;
}
export interface BulkResult {
  succeeded: string[];
  failed: { fileId: string; reason: string }[];
}
export type SortBy = "date" | "size" | "type" | "owner";

export const isFolder = (f: Pick<DriveItem, "mimeType">) => f.mimeType === FOLDER_MIME;

/** AMA FileGridItem 의 종류별 아이콘·색 매핑 그대로. */
export function fileIcon(mimeType: string): { Icon: LucideIcon; color: string; bg: string } {
  if (mimeType === FOLDER_MIME) return { Icon: FolderIcon, color: "text-yellow-500", bg: "bg-yellow-50" };
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return { Icon: FileSpreadsheet, color: "text-green-600", bg: "bg-green-50" };
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return { Icon: Presentation, color: "text-orange-500", bg: "bg-orange-50" };
  if (mimeType.includes("document") || mimeType.includes("word"))
    return { Icon: FileText, color: "text-blue-600", bg: "bg-blue-50" };
  if (mimeType.startsWith("image/")) return { Icon: FileImage, color: "text-pink-500", bg: "bg-pink-50" };
  if (mimeType.startsWith("video/")) return { Icon: Film, color: "text-red-500", bg: "bg-red-50" };
  if (mimeType.startsWith("audio/")) return { Icon: Music, color: "text-purple-500", bg: "bg-purple-50" };
  if (mimeType === "application/pdf") return { Icon: FileText, color: "text-red-600", bg: "bg-red-50" };
  return { Icon: File, color: "text-gray-500", bg: "bg-gray-50" };
}

export const fileSize = (size?: string | number | null) => {
  const b = Number(size ?? 0);
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};
export const fileDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");
export const ownerName = (f: DriveItem) => f.owners?.[0]?.displayName ?? f.owners?.[0]?.emailAddress ?? "—";

/** 폴더는 항상 앞, 그다음 정렬 기준(AMA 와 같은 4종). */
export function sortItems(items: DriveItem[], by: SortBy, dir: "asc" | "desc") {
  const k = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (isFolder(a) !== isFolder(b)) return isFolder(a) ? -1 : 1;
    const v =
      by === "size"
        ? Number(a.size ?? 0) - Number(b.size ?? 0)
        : by === "type"
          ? a.mimeType.localeCompare(b.mimeType)
          : by === "owner"
            ? ownerName(a).localeCompare(ownerName(b))
            : (a.modifiedTime ?? "").localeCompare(b.modifiedTime ?? "");
    return v * k || a.name.localeCompare(b.name);
  });
}

export function stored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
export function store(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}
