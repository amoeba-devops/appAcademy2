import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowUpDown,
  CheckCircle,
  CheckSquare,
  ChevronRight,
  Download,
  Eye,
  ExternalLink,
  FolderInput,
  FolderPlus,
  LayoutGrid,
  List,
  Loader2,
  MoreVertical,
  Pencil,
  Square,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { errorText, useScope } from "../project-page";
import { driveOperation } from "../drive-operation";
import {
  driveBase,
  fileDate,
  fileIcon,
  fileSize,
  isFolder,
  MAX_UPLOAD,
  ownerName,
  sortItems,
  store,
  stored,
  type BulkResult,
  type DriveItem,
  type Folder,
  type SortBy,
} from "./drive-model";

const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50";
const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const SORTS: SortBy[] = ["date", "size", "type", "owner"];

export type Notify = (ok: boolean, message: string) => void;
type Crumb = { id: string; name: string };

/** 정렬·보기 도구(폴더 보기·검색 공통) */
export function ViewTools({
  sort,
  setSort,
  dir,
  setDir,
  view,
  setView,
}: {
  sort: SortBy;
  setSort: (s: SortBy) => void;
  dir: "asc" | "desc";
  setDir: (d: "asc" | "desc") => void;
  view: "list" | "grid";
  setView: (v: "list" | "grid") => void;
}) {
  const { t } = useTranslation("common");
  return (
    <>
      <span className="inline-flex items-center gap-1 text-gray-400">
        <ArrowUpDown className="h-3.5 w-3.5" />
        <select
          aria-label={t("driveUi.sortLabel")}
          className="rounded-lg border border-gray-200 py-1 pl-2 pr-6 text-xs text-gray-700"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortBy)}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`driveUi.sort.${s}`)}
            </option>
          ))}
        </select>
      </span>
      <button
        type="button"
        aria-label={t("driveUi.sortDir")}
        onClick={() => setDir(dir === "asc" ? "desc" : "asc")}
        className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
      >
        {dir === "asc" ? "↑" : "↓"}
      </button>
      <div className="flex rounded-lg border border-gray-200">
        {(["list", "grid"] as const).map((v) => {
          const Icon = v === "list" ? List : LayoutGrid;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              aria-label={t(`driveUi.view.${v}`)}
              title={t(`driveUi.view.${v}`)}
              onClick={() => setView(v)}
              className={`p-1.5 ${view === v ? "bg-purple-100 text-purple-600" : "text-gray-400 hover:text-gray-600"}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </>
  );
}

export function useViewPrefs() {
  const [view, setViewState] = useState<"list" | "grid">(() => stored("acm-drive-view-mode", ["list", "grid"] as const, "list"));
  const [sort, setSortState] = useState<SortBy>(() => stored("acm-drive-sort-by", SORTS, "date"));
  const [dir, setDirState] = useState<"asc" | "desc">(() => stored("acm-drive-sort-dir", ["asc", "desc"] as const, "desc"));
  return {
    view,
    setView: (v: "list" | "grid") => (setViewState(v), store("acm-drive-view-mode", v)),
    sort,
    setSort: (v: SortBy) => (setSortState(v), store("acm-drive-sort-by", v)),
    dir,
    setDir: (v: "asc" | "desc") => (setDirState(v), store("acm-drive-sort-dir", v)),
  };
}

/** 파일 행/카드 공통 메뉴 — 이름 변경·이동·휴지통 */
function ActionMenu({ onRename, onMove, onTrash }: { onRename: () => void; onMove: () => void; onTrash: () => void }) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50";
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={t("driveUi.actions.more")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-8 z-30 w-40 rounded-lg border bg-white py-1 shadow-lg">
          <button role="menuitem" type="button" className={`${item} text-gray-700`} onClick={() => (setOpen(false), onRename())}>
            <Pencil className="h-4 w-4" />
            {t("driveUi.actions.rename")}
          </button>
          <button role="menuitem" type="button" className={`${item} text-gray-700`} onClick={() => (setOpen(false), onMove())}>
            <FolderInput className="h-4 w-4" />
            {t("driveUi.actions.move")}
          </button>
          <button role="menuitem" type="button" className={`${item} text-red-600 hover:bg-red-50`} onClick={() => (setOpen(false), onTrash())}>
            <Trash2 className="h-4 w-4" />
            {t("driveUi.actions.trash")}
          </button>
        </div>
      )}
    </div>
  );
}

/** 목록/카드 렌더 — 폴더는 열기, 파일은 상세 */
export function FileItems({
  items,
  view,
  selecting,
  selected,
  toggle,
  onOpen,
  canEdit,
  onRename,
  onMove,
  onTrash,
  showFolder = false,
}: {
  items: DriveItem[];
  view: "list" | "grid";
  selecting: boolean;
  selected: Set<string>;
  toggle: (id: string) => void;
  onOpen: (f: DriveItem) => void;
  canEdit: boolean;
  onRename: (f: DriveItem) => void;
  onMove: (f: DriveItem) => void;
  onTrash: (f: DriveItem) => void;
  showFolder?: boolean;
}) {
  const state = (f: DriveItem) =>
    selected.has(f.id) ? "border-indigo-400 bg-indigo-50/50" : "border-gray-100 hover:border-gray-300 hover:bg-gray-50";
  const check = (f: DriveItem) =>
    selecting && (
      <input
        type="checkbox"
        aria-label={f.name}
        className="h-4 w-4 accent-indigo-600"
        checked={selected.has(f.id)}
        onClick={(e) => e.stopPropagation()}
        onChange={() => toggle(f.id)}
      />
    );
  const menu = (f: DriveItem) =>
    canEdit && <ActionMenu onRename={() => onRename(f)} onMove={() => onMove(f)} onTrash={() => onTrash(f)} />;
  if (view === "grid")
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((f) => {
          const { Icon, color, bg } = fileIcon(f.mimeType);
          return (
            <div
              key={f.id}
              role="button"
              tabIndex={0}
              onClick={() => (selecting ? toggle(f.id) : onOpen(f))}
              onKeyDown={(e) => e.key === "Enter" && onOpen(f)}
              className={`group relative flex cursor-pointer flex-col items-center rounded-xl border bg-white p-4 text-center ${state(f)}`}
            >
              <span className="absolute left-2 top-2">{check(f)}</span>
              <span className="absolute right-1 top-1">{menu(f)}</span>
              {f.thumbnailLink && !isFolder(f) ? (
                <img src={f.thumbnailLink} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <span className={`flex h-16 w-16 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-8 w-8 ${color}`} />
                </span>
              )}
              <span className="mt-2 line-clamp-2 w-full break-all text-sm font-medium text-gray-900">{f.name}</span>
              <span className="mt-0.5 text-xs text-gray-400">
                {isFolder(f) ? fileDate(f.modifiedTime) : `${fileSize(f.size)} · ${fileDate(f.modifiedTime)}`}
              </span>
            </div>
          );
        })}
      </div>
    );
  return (
    <div className="space-y-1">
      {items.map((f) => {
        const { Icon, color } = fileIcon(f.mimeType);
        return (
          <div
            key={f.id}
            role="button"
            tabIndex={0}
            onClick={() => (selecting ? toggle(f.id) : onOpen(f))}
            onKeyDown={(e) => e.key === "Enter" && onOpen(f)}
            className={`group flex cursor-pointer items-center gap-3 rounded-lg border bg-white px-4 py-3 ${state(f)}`}
          >
            {check(f)}
            <Icon className={`h-5 w-5 shrink-0 ${color}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-gray-900">{f.name}</span>
              {showFolder && f.folderTitle && <span className="block truncate text-xs text-gray-400">{f.folderTitle}</span>}
            </span>
            <span className="w-20 shrink-0 text-right text-xs text-gray-400">{isFolder(f) ? "—" : fileSize(f.size)}</span>
            <span className="w-24 shrink-0 text-right text-xs text-gray-400">{fileDate(f.modifiedTime)}</span>
            <span className="hidden w-28 shrink-0 truncate text-right text-xs text-gray-400 sm:block">{ownerName(f)}</span>
            <span className="w-8 shrink-0">{menu(f)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 파일 상세 팝업 — Drive에서 열기·미리보기·다운로드 */
export function FileDetailModal({ folder, file, close }: { folder: string; file: DriveItem; close: () => void }) {
  const { t } = useTranslation("common");
  const scope = useScope();
  const q = useQuery({
    queryKey: ["shared-drive", folder, "detail", file.id, ...scope],
    queryFn: async () => (await apiClient.get<DriveItem>(`${driveBase}/${folder}/files/${encodeURIComponent(file.id)}`)).data,
  });
  const d = q.data ?? file;
  const { Icon, color, bg } = fileIcon(d.mimeType);
  const view = d.webViewLink ?? `https://drive.google.com/file/d/${encodeURIComponent(d.id)}/view`;
  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-labelledby="drive-detail-title" className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </span>
          <h2 id="drive-detail-title" className="min-w-0 flex-1 break-all text-base font-semibold text-gray-900">
            {d.name}
          </h2>
          <button type="button" aria-label={t("driveUi.close")} onClick={close} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-6 py-4 text-sm">
          {[
            ["type", d.mimeType.replace("application/vnd.google-apps.", "Google ")],
            ["size", fileSize(d.size)],
            ["modified", fileDate(d.modifiedTime)],
            ["owner", ownerName(d)],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-gray-400">{t(`driveUi.detail.${k}`)}</dt>
              <dd className="truncate text-gray-800">{v}</dd>
            </div>
          ))}
        </dl>
        {q.error && <p role="alert" className="px-6 text-sm text-red-600">{errorText(q.error)}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button type="button" className={btnSecondary} onClick={() => open(view)}>
            <ExternalLink className="h-4 w-4" />
            {t("driveUi.detail.openInDrive")}
          </button>
          <button type="button" className={btnSecondary} onClick={() => open(`https://drive.google.com/file/d/${encodeURIComponent(d.id)}/preview`)}>
            <Eye className="h-4 w-4" />
            {t("driveUi.detail.preview")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
            onClick={() => open(d.webContentLink ?? view)}
          >
            <Download className="h-4 w-4" />
            {t("driveUi.detail.download")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 이동 대상 폴더 선택 — 같은 연결 폴더 안에서만 */
export function MoveDestinationModal({
  folder,
  items,
  close,
  done,
}: {
  folder: Folder;
  items: DriveItem[];
  close: () => void;
  done: (r: BulkResult, target: string) => void;
}) {
  const { t } = useTranslation("common");
  const scope = useScope();
  const [trail, setTrail] = useState<Crumb[]>([{ id: folder.file_id, name: folder.title }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const here = trail[trail.length - 1];
  const moving = new Set(items.map((i) => i.id));
  const q = useQuery({
    queryKey: ["shared-drive", folder.drf_id, "move-browse", here.id, ...scope],
    queryFn: async () =>
      (await apiClient.get<{ files: DriveItem[] }>(`${driveBase}/${folder.drf_id}`, { params: { parent: here.id } })).data.files.filter(
        (f) => isFolder(f) && !moving.has(f.id),
      ),
  });
  const title = items.length === 1 ? t("driveUi.move.titleOne", { name: items[0].name }) : t("driveUi.move.titleMany", { count: items.length });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && close()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="truncate text-base font-semibold text-gray-900">{title}</h2>
          <nav className="mt-1 flex flex-wrap items-center gap-0.5 text-xs">
            {trail.map((c, i) => (
              <span key={c.id} className="inline-flex items-center">
                {i > 0 && <ChevronRight className="h-3 w-3 text-gray-300" />}
                <button type="button" onClick={() => setTrail(trail.slice(0, i + 1))} className="rounded px-1 py-0.5 text-gray-600 hover:bg-gray-100">
                  {c.name}
                </button>
              </span>
            ))}
          </nav>
        </div>
        <div className="min-h-40 flex-1 overflow-y-auto p-3">
          {q.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : !q.data?.length ? (
            <p className="py-8 text-center text-sm text-gray-400">{t("driveUi.move.noSubfolders")}</p>
          ) : (
            q.data.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTrail([...trail, { id: f.id, name: f.name }])}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                {(() => {
                  const { Icon, color } = fileIcon(f.mimeType);
                  return <Icon className={`h-4 w-4 ${color}`} />;
                })()}
                <span className="flex-1 truncate">{f.name}</span>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
            ))
          )}
        </div>
        {error && <p role="alert" className="px-5 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button type="button" className={btnSecondary} disabled={busy} onClick={close}>
            {t("driveUi.cancel")}
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = (
                  await apiClient.post<BulkResult>(`${driveBase}/${folder.drf_id}/move`, {
                    fileIds: items.map((i) => i.id),
                    targetId: here.id,
                  })
                ).data;
                done(r, here.name);
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("driveUi.move.here")}
          </button>
        </div>
      </div>
    </div>
  );
}

interface UploadRow {
  name: string;
  size: number;
  state: "wait" | "run" | "ok" | "fail";
}

/** 연결 폴더 안 탐색(경로·정렬·보기·선택·새 폴더·업로드·더 보기·일괄 작업) */
export function FolderView({
  folder,
  trail,
  setTrail,
  onExit,
  notify,
}: {
  folder: Folder;
  trail: Crumb[];
  setTrail: (t: Crumb[]) => void;
  /** 전체 폴더(연결 폴더 목록)로 */
  onExit: () => void;
  notify: Notify;
}) {
  const { t } = useTranslation("common");
  const scope = useScope();
  const prefs = useViewPrefs();
  const canEdit = folder.access === "EDIT";
  const parent = trail.length ? trail[trail.length - 1].id : folder.file_id;
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [detail, setDetail] = useState<DriveItem | null>(null);
  const [moving, setMoving] = useState<DriveItem[] | null>(null);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const q = useInfiniteQuery({
    queryKey: ["shared-drive", folder.drf_id, "browse", parent, ...scope],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (
        await apiClient.get<{ files: DriveItem[]; nextPageToken?: string }>(`${driveBase}/${folder.drf_id}`, {
          params: { parent, page: pageParam },
        })
      ).data,
    getNextPageParam: (last) => last.nextPageToken,
  });
  useEffect(() => {
    setSelected(new Set());
  }, [parent]);
  const items = sortItems(q.data?.pages.flatMap((p) => p.files) ?? [], prefs.sort, prefs.dir);
  const refresh = () => q.refetch();
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const report = (r: BulkResult, ok: string) => {
    if (!r.failed.length) notify(true, ok);
    else notify(false, [t("driveUi.bulk.partial", { ok: r.succeeded.length, fail: r.failed.length }), ...r.failed.map((f) => `· ${f.reason}`)].join("\n"));
  };
  const rename = async (f: DriveItem) => {
    const name = window.prompt(t("driveUi.rename.prompt"), f.name)?.trim();
    if (!name || name === f.name) return;
    try {
      await apiClient.patch(`${driveBase}/${folder.drf_id}/files/${encodeURIComponent(f.id)}`, { name });
      notify(true, t("driveUi.rename.done"));
      await refresh();
    } catch (e) {
      notify(false, errorText(e));
    }
  };
  const trash = async (list: DriveItem[]) => {
    const msg = list.length === 1 ? t("driveUi.trash.confirmOne", { name: list[0].name }) : t("driveUi.trash.confirmMany", { count: list.length });
    if (!window.confirm(msg)) return;
    try {
      const r = (await apiClient.post<BulkResult>(`${driveBase}/${folder.drf_id}/trash`, { fileIds: list.map((x) => x.id) })).data;
      report(r, t("driveUi.trash.done", { count: r.succeeded.length }));
      setSelected(new Set());
      await refresh();
    } catch (e) {
      notify(false, errorText(e));
    }
  };
  const newFolder = async () => {
    const title = window.prompt(t("driveUi.newFolderPrompt"))?.trim();
    if (!title) return;
    try {
      const op = await driveOperation({ folder: folder.drf_id, parent, title, kind: "FOLDER" });
      await apiClient.post(`${driveBase}/${folder.drf_id}/create`, { title, kind: "FOLDER", parentId: parent, operationId: op.id });
      op.done();
      await refresh();
    } catch (e) {
      notify(false, errorText(e));
    }
  };
  const upload = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const rows: UploadRow[] = list.map((f) => ({ name: f.name, size: f.size, state: f.size > MAX_UPLOAD ? "fail" : "wait" }));
    setUploads(rows);
    if (list.some((f) => f.size > MAX_UPLOAD)) notify(false, t("driveUi.upload.tooLarge"));
    for (let i = 0; i < list.length; i++) {
      if (rows[i].state === "fail") continue;
      setUploads((r) => r.map((x, j) => (j === i ? { ...x, state: "run" } : x)));
      try {
        const file = list[i];
        const op = await driveOperation({ folder: folder.drf_id, parent, name: file.name }, file);
        const data = new FormData();
        data.append("file", file);
        data.append("title", file.name);
        data.append("kind", "DOCUMENT");
        data.append("parentId", parent);
        data.append("operationId", op.id);
        await apiClient.post(`${driveBase}/${folder.drf_id}/upload`, data);
        op.done();
        setUploads((r) => r.map((x, j) => (j === i ? { ...x, state: "ok" } : x)));
      } catch {
        setUploads((r) => r.map((x, j) => (j === i ? { ...x, state: "fail" } : x)));
        notify(false, t("driveUi.upload.failed"));
      }
    }
    if (fileInput.current) fileInput.current.value = "";
    await refresh();
    setTimeout(() => setUploads([]), 5000);
  };
  const selectedItems = items.filter((i) => selected.has(i.id));
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap items-center gap-0.5 text-sm" aria-label={t("driveUi.breadcrumb")}>
          <button type="button" onClick={onExit} className="rounded px-1.5 py-0.5 text-gray-600 hover:bg-gray-100">
            {t("driveUi.allFolders")}
          </button>
          {[{ id: folder.file_id, name: folder.title }, ...trail].map((c, i, all) => (
            <span key={c.id} className="inline-flex items-center">
              <ChevronRight className="h-4 w-4 text-gray-300" />
              {i === all.length - 1 ? (
                <span className="px-1.5 py-0.5 font-medium text-gray-900">{c.name}</span>
              ) : (
                <button type="button" onClick={() => setTrail(trail.slice(0, i))} className="rounded px-1.5 py-0.5 text-gray-600 hover:bg-gray-100">
                  {c.name}
                </button>
              )}
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <ViewTools {...prefs} />
          {canEdit && (
            <>
              <button
                type="button"
                aria-pressed={selecting}
                onClick={() => {
                  setSelecting((v) => !v);
                  setSelected(new Set());
                }}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${selecting ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                {selecting ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {selecting ? t("driveUi.select.cancel") : t("driveUi.select.start")}
              </button>
              <button type="button" className={btnSecondary} onClick={() => void newFolder()}>
                <FolderPlus className="h-4 w-4" />
                {t("driveUi.newFolder")}
              </button>
              <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
              <button type="button" className={btnPrimary} onClick={() => fileInput.current?.click()}>
                <Upload className="h-4 w-4" />
                {t("driveUi.upload.button")}
              </button>
            </>
          )}
        </div>
      </div>
      {/* REQ-261018C — 업로드 위치 안내(프로젝트 자료는 문서 › 파일의 프로젝트 폴더에 따로 저장) */}
      {canEdit && (
        <div className="mb-3 grid gap-0.5 text-xs text-secondary">
          <p>
            {t("storagePath.driveUploadTo", {
              path: [folder.title, ...trail.map((c) => c.name)].join(" › "),
            })}
          </p>
          <p>{t("storagePath.driveProjectHint")}</p>
        </div>
      )}
      {uploads.length > 0 && (
        <div className="mb-4 space-y-1 rounded-lg border p-3">
          {uploads.map((u, i) => (
            <div key={`${u.name}-${i}`} className="flex items-center gap-2 text-sm">
              {u.state === "run" ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              ) : u.state === "ok" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : u.state === "fail" ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <span className="h-4 w-4 rounded-full border-2 border-gray-300" />
              )}
              <span className="flex-1 truncate">{u.name}</span>
              <span className="text-xs text-gray-400">{(u.size / 1048576).toFixed(1)} MB</span>
            </div>
          ))}
        </div>
      )}
      {q.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorText(q.error)}
        </p>
      ) : q.isLoading ? (
        <div className="flex justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
        </div>
      ) : !items.length ? (
        <p className="py-12 text-center text-sm text-gray-500">{t("driveUi.emptyFolder")}</p>
      ) : (
        <FileItems
          items={items}
          view={prefs.view}
          selecting={selecting}
          selected={selected}
          toggle={toggle}
          canEdit={canEdit}
          onOpen={(f) => (isFolder(f) ? setTrail([...trail, { id: f.id, name: f.name }]) : setDetail(f))}
          onRename={(f) => void rename(f)}
          onMove={(f) => setMoving([f])}
          onTrash={(f) => void trash([f])}
        />
      )}
      {q.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <button type="button" className={btnSecondary} disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
            {q.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("driveUi.loadMore")}
          </button>
        </div>
      )}
      {selecting && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm shadow-2xl">
            <span className="font-medium text-gray-800">{t("driveUi.select.count", { count: selected.size })}</span>
            <span className="text-gray-200">|</span>
            <button type="button" className="text-indigo-600 hover:underline" onClick={() => setSelected(new Set(items.map((i) => i.id)))}>
              {t("driveUi.select.all")}
            </button>
            <button type="button" className="text-gray-600 hover:underline" onClick={() => setSelected(new Set())}>
              {t("driveUi.select.clear")}
            </button>
            <button type="button" className={btnSecondary} onClick={() => setMoving(selectedItems)}>
              <FolderInput className="h-4 w-4" />
              {t("driveUi.actions.move")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              onClick={() => void trash(selectedItems)}
            >
              <Trash2 className="h-4 w-4" />
              {t("driveUi.actions.trash")}
            </button>
          </div>
        </div>
      )}
      {detail && <FileDetailModal folder={folder.drf_id} file={detail} close={() => setDetail(null)} />}
      {moving && (
        <MoveDestinationModal
          folder={folder}
          items={moving}
          close={() => setMoving(null)}
          done={(r, target) => {
            setMoving(null);
            setSelected(new Set());
            report(r, t("driveUi.move.done", { folder: target }));
            void refresh();
          }}
        />
      )}
    </>
  );
}
