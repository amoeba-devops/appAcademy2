import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, FolderKanban, FolderOpen, HardDrive, Link2, Search, Settings, Unlink, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveConnection, errorText, useScope, useWork } from "./project-page";
import { pickGoogle } from "./google-picker";
import type { DriveStatus, Person } from "./types";
import { driveBase, isFolder, sortItems, type DriveItem, type Folder } from "./drive/drive-model";
import { FileDetailModal, FileItems, FolderView, useViewPrefs, ViewTools } from "./drive/drive-browser";
/**
 * REQ-261016E — /admin/drive: AMA /drive 와 같은 한 화면 구성.
 * 헤더(제목·부제·읽기 전용·전체 검색) → 폴더 카드 → 폴더 안 탐색(경로·정렬·목록/카드·선택·새 폴더·업로드).
 * ACM 고유: 연결 관리(회사 Google 계정)·폴더 연결·공유 대상 권한.
 */
export function SharedDrivePage() {
  const { t } = useTranslation("common");
  // UI-261019 P4 — /admin/config/drive 에서 열렸을 때만 "← 서비스 설정" 뒤로 링크.
  const fromConfig = useLocation().pathname.startsWith("/admin/config/");
  const scope = useScope(),
    qc = useQueryClient(),
    w = useWork();
  const [manage, setManage] = useState(false),
    [permissions, setPermissions] = useState<Folder | "new" | null>(null),
    [open, setOpen] = useState<Folder | null>(null),
    [trail, setTrail] = useState<{ id: string; name: string }[]>([]),
    [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [detail, setDetail] = useState<DriveItem | null>(null),
    [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);
  const prefs = useViewPrefs();
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 500);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.ok ? 3000 : 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const notify = (ok: boolean, message: string) => setToast({ ok, message });
  const status = useQuery({
    queryKey: ["prj-drive", ...scope],
    queryFn: async () => (await apiClient.get<DriveStatus>("/acm/prj/drive")).data,
  });
  const folders = useQuery({
    queryKey: ["shared-drive", ...scope],
    queryFn: async () => (await apiClient.get<Folder[]>(driveBase)).data,
  });
  const searching = term.length >= 2;
  const results = useQuery({
    enabled: searching,
    queryKey: ["shared-drive", "search", term, ...scope],
    queryFn: async () => (await apiClient.get<{ files: DriveItem[] }>(`${driveBase}/search`, { params: { q: term } })).data.files,
  });
  const readOnly = open ? open.access !== "EDIT" : !!folders.data?.length && folders.data.every((f) => f.access !== "EDIT");
  const openFolder = (f: Folder, path: { id: string; name: string }[] = []) => {
    setOpen(f);
    setTrail(path);
    setSearch("");
    setTerm("");
  };
  return (
    <div className="min-w-0">
      <PageHeader
        back={fromConfig ? { to: "/admin/config", label: t("nav.config") } : undefined}
        icon={FolderKanban}
        title={t("nav.drive")}
        description={t("pageHeader.drive.desc")}
        meta={
          <>
            {readOnly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                <Eye className="h-3 w-3" />
                {t("driveUi.readOnly")}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {status.data?.connected ? t("driveUi.account", { email: status.data.email }) : t("driveUi.notConnected")}
            </span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setManage(!manage)}
            >
              <Settings className="h-4 w-4" />
              {t("driveUi.manageConnection")}
            </button>
            {status.data?.canManage && (
              <button
                type="button"
                disabled={!status.data.connected}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
                onClick={() => setPermissions("new")}
              >
                <Link2 className="h-4 w-4" />
                {t("driveUi.linkFolder")}
              </button>
            )}
          </>
        }
      />
      <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* 검색 */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("driveUi.searchPlaceholder")}
              aria-label={t("driveUi.searchPlaceholder")}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* 본문 */}
        <div className="min-h-[60vh] flex-1 overflow-y-auto px-6 py-4">
          {(manage || (status.data && !status.data.connected)) && (
            <div className="mb-4 rounded-xl border border-gray-200 p-4">
              <DriveConnection />
            </div>
          )}
          {(w.error || folders.error) && (
            <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {w.error || errorText(folders.error)}
            </p>
          )}
          {searching ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700">{t("driveUi.searchResults")}</span>
                <div className="flex items-center gap-2">
                  <ViewTools {...prefs} />
                </div>
              </div>
              {results.isLoading ? (
                <div className="flex justify-center py-12">
                  <span className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
                </div>
              ) : results.error ? (
                <p role="alert" className="text-sm text-red-600">{errorText(results.error)}</p>
              ) : !results.data?.length ? (
                <p className="py-12 text-center text-sm text-gray-500">{t("driveUi.noResults")}</p>
              ) : (
                <FileItems
                  items={sortItems(results.data, prefs.sort, prefs.dir)}
                  view={prefs.view}
                  selecting={false}
                  selected={new Set()}
                  toggle={() => undefined}
                  canEdit={false}
                  showFolder
                  onOpen={(f) => {
                    const owner = folders.data?.find((x) => x.drf_id === f.drfId);
                    if (!owner) return;
                    if (isFolder(f)) openFolder(owner, [{ id: f.id, name: f.name }]);
                    else setDetail(f);
                  }}
                  onRename={() => undefined}
                  onMove={() => undefined}
                  onTrash={() => undefined}
                />
              )}
            </>
          ) : open ? (
            <FolderView folder={open} trail={trail} setTrail={setTrail} onExit={() => setOpen(null)} notify={notify} />
          ) : folders.isLoading ? (
            <div className="flex justify-center py-12">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
            </div>
          ) : !folders.data?.length ? (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <FolderOpen className="h-8 w-8 text-gray-400" />
              </span>
              <p className="mt-3 text-sm font-medium text-gray-700">{t("driveUi.noFolders")}</p>
              <p className="mt-1 text-sm text-gray-500">{t("driveUi.noFoldersHint")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {folders.data.map((f) => (
                <div
                  key={f.drf_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openFolder(f)}
                  onKeyDown={(e) => e.key === "Enter" && openFolder(f)}
                  className="group flex cursor-pointer items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 hover:border-purple-300 hover:bg-purple-50"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-100">
                    <FolderOpen className="h-6 w-6 text-purple-600" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900">{f.title}</span>
                    <span className="mt-1 inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                        <HardDrive className="h-3 w-3" />
                        {t("driveUi.sharedFolder")}
                      </span>
                      <span className={`text-[11px] ${f.access === "EDIT" ? "text-indigo-600" : "text-gray-400"}`}>
                        {f.access === "EDIT" ? t("driveUi.canEdit") : t("driveUi.readOnly")}
                      </span>
                    </span>
                  </span>
                  {status.data?.canManage && (
                    <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title={t("driveUi.shareTargets")}
                        aria-label={t("driveUi.shareTargets")}
                        onClick={() => setPermissions(f)}
                        className="rounded-md p-2 text-gray-400 hover:bg-purple-100 hover:text-purple-600"
                      >
                        <Users className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title={t("driveUi.unlink")}
                        aria-label={t("driveUi.unlink")}
                        disabled={w.busy}
                        onClick={() => {
                          if (window.confirm(t("driveUi.unlinkConfirm")))
                            void w.run(async () => {
                              await apiClient.delete(`${driveBase}/${f.drf_id}`);
                              await qc.invalidateQueries({ queryKey: ["shared-drive"] });
                            });
                        }}
                        className="rounded-md p-2 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                      >
                        <Unlink className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {permissions && <FolderPermissions folder={permissions === "new" ? undefined : permissions} close={() => setPermissions(null)} />}
        {detail?.drfId && <FileDetailModal folder={detail.drfId} file={detail} close={() => setDetail(null)} />}
        {toast && (
          <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
            <div
              role="status"
              className={`max-w-md whitespace-pre-line rounded-xl px-4 py-2.5 text-sm text-white shadow-2xl ${toast.ok ? "bg-green-600" : "bg-red-600"}`}
            >
              {toast.message}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
function FolderPermissions({
  folder,
  close,
}: {
  folder?: Folder;
  close: () => void;
}) {
  const scope = useScope(),
    qc = useQueryClient(),
    w = useWork();
  const [fileId, setFileId] = useState(folder?.file_id ?? ""),
    [operatorAccess, setOperatorAccess] = useState(
      folder?.operator_access ?? "NONE",
    ),
    [choices, setChoices] = useState<Record<string, string> | null>(null);
  const people = useQuery({
    queryKey: ["prj-people", ...scope],
    queryFn: async () =>
      (await apiClient.get<Person[]>("/acm/prj/people")).data,
  });
  const members = useQuery({
    queryKey: ["shared-drive", folder?.drf_id, "permissions", ...scope],
    enabled: !!folder,
    queryFn: async () =>
      (
        await apiClient.get<{ usr_id: string; access: string }[]>(
          `${driveBase}/${folder!.drf_id}/permissions`,
        )
      ).data,
  });
  const selected =
    choices ??
    Object.fromEntries((members.data ?? []).map((m) => [m.usr_id, m.access]));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !w.busy) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>공용 폴더 · 공유 대상</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          프로젝트 자료와 겹치지 않는 폴더를 연결하세요. Google 공유 권한은
          변경하지 않습니다.
        </p>
        <Button
          variant="outline"
          disabled={w.busy || !!folder}
          onClick={() =>
            void w.run(async () => {
              const id = await pickGoogle(true);
              if (id) setFileId(id);
            })
          }
        >
          {fileId ? "폴더 선택됨" : "Google 폴더 선택"}
        </Button>
        <label>
          학원 운영자 (관리자·직원)
          <select
            className="w-full rounded border p-2"
            value={operatorAccess}
            onChange={(e) => setOperatorAccess(e.target.value)}
          >
            <option value="NONE">공유 안 함</option>
            <option value="VIEW">열람</option>
            <option value="EDIT">편집</option>
          </select>
        </label>
        <div className="max-h-64 overflow-auto">
          {people.data?.map((p) => (
            <label key={p.id} className="flex justify-between gap-2 py-2">
              {p.name}
              <select
                className="rounded border p-2"
                value={selected[p.id] ?? "NONE"}
                onChange={(e) =>
                  setChoices({ ...selected, [p.id]: e.target.value })
                }
              >
                <option value="NONE">지정 안 함</option>
                <option value="VIEW">열람</option>
                <option value="EDIT">편집</option>
              </select>
            </label>
          ))}
        </div>
        <p className="text-xs">
          설정 관리자는 연결 및 공유 대상을 관리할 수 있습니다. 운영자 권한과
          개인 권한 중 높은 권한이 적용됩니다.
        </p>
        {(w.error || members.error || people.error) && (
          <p role="alert" className="text-red-600">
            {w.error || errorText(members.error || people.error)}
          </p>
        )}
        <Button
          disabled={
            w.busy ||
            !fileId ||
            people.isLoading ||
            !!people.error ||
            !!members.error ||
            (!!folder && members.isLoading)
          }
          onClick={() =>
            void w.run(async () => {
              await apiClient.post(driveBase, {
                fileId,
                operatorAccess,
                viewers: Object.keys(selected).filter(
                  (k) => selected[k] === "VIEW",
                ),
                editors: Object.keys(selected).filter(
                  (k) => selected[k] === "EDIT",
                ),
              });
              await qc.invalidateQueries({ queryKey: ["shared-drive"] });
              close();
            })
          }
        >
          저장
        </Button>
      </DialogContent>
    </Dialog>
  );
}
