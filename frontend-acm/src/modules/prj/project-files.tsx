import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StorageLocation } from "./storage-location";
import { DeleteItemButton } from "./delete-item-button";
import { apiClient } from "@/lib/api-client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { errorText, useScope } from "./project-page";
import type { DriveStatus, Item, Project } from "./types";
/** 파일 단계 코드 (표시 라벨은 i18n `prj:phase.*`). */
export const phases = ["PLANNING", "DESIGN", "DEVELOPMENT", "OPERATION", "ETC"];
export function ProjectFiles({
  project,
  items,
  readOnly,
}: {
  project: string;
  items: Item[];
  readOnly: boolean;
}) {
  const { t: tp } = useTranslation("prj");
  const qc = useQueryClient(),
    [upload, setUpload] = useState(false),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("created"),
    [phase, setPhase] = useState(""),
    [error, setError] = useState("");
  const rows = items
    .filter(
      (i) =>
        i.pit_kind === "FILE" &&
        (!phase || i.file_phase === phase) &&
        `${i.pit_title} ${i.pit_body} ${i.creator_name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "size"
        ? Number(b.drive_size ?? 0) - Number(a.drive_size ?? 0)
        : sort === "downloads"
          ? (b.download_count ?? 0) - (a.download_count ?? 0)
          : sort === "name"
            ? a.pit_title.localeCompare(b.pit_title)
            : sort === "oldest"
              ? a.created_at.localeCompare(b.created_at)
              : b.created_at.localeCompare(a.created_at),
    );
  return (
    <section className="grid min-w-0 gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          aria-label={tp("projectFiles.search")}
          placeholder={tp("projectFiles.searchPlaceholder")}
          className="rounded border p-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label={tp("projectFiles.sortLabel")}
          className="rounded border p-2"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="created">{tp("common.sortRecentCreated")}</option>
          <option value="oldest">{tp("projectFiles.sortOldestCreated")}</option>
          <option value="name">{tp("common.sortName")}</option>
          <option value="size">{tp("common.sortSize")}</option>
          <option value="downloads">{tp("common.sortDownloads")}</option>
        </select>
        <select
          aria-label={tp("common.phase")}
          className="rounded border p-2"
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
        >
          <option value="">{tp("common.allPhases")}</option>
          {phases.map((v) => (
            <option key={v} value={v}>
              {tp(`phase.${v}`)}
            </option>
          ))}
        </select>
        {!readOnly && (
          <button
            className="rounded bg-accent-600 px-3 py-2 text-white"
            onClick={() => setUpload(true)}
          >
            + {tp("projectFiles.upload")}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              {[
                "name",
                "description",
                "phase",
                "uploader",
                "createdAt",
                "size",
                "downloads",
                "actions",
              ].map((v) => (
                <th className="whitespace-nowrap p-3" key={v}>
                  {tp(`projectFiles.cols.${v}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr className="border-t" key={i.pit_id}>
                <td className="p-3">{i.pit_title}</td>
                <td className="p-3">{i.pit_body || "-"}</td>
                <td className="p-3">
                  {phases.includes(i.file_phase ?? "ETC")
                    ? tp(`phase.${i.file_phase ?? "ETC"}`)
                    : ""}
                </td>
                <td className="p-3">{i.creator_name}</td>
                <td className="whitespace-nowrap p-3">
                  {new Date(i.created_at).toLocaleDateString()}
                </td>
                <td className="p-3">
                  {Math.ceil(Number(i.drive_size ?? 0) / 1024)}KB
                </td>
                <td className="p-3">{i.download_count ?? 0}</td>
                <td className="p-3">
                  <div className="flex gap-3">
                    <button
                      className="text-blue-600"
                      onClick={async () => {
                        const win = window.open("about:blank", "_blank");
                        if (win) win.opener = null;
                        try {
                          const { data } = await apiClient.get<{ url: string }>(
                            `/acm/prj/projects/${project}/files/${i.pit_id}/download`,
                          );
                          if (win) win.location.href = data.url;
                          else window.location.assign(data.url);
                          await qc.invalidateQueries({ queryKey: ["prj"] });
                        } catch (e) {
                          win?.close();
                          setError(errorText(e));
                        }
                      }}
                    >
                      {tp("projectFiles.download")}
                    </button>
                    {/* REQ-261019 — 작성자·담당자·테넌트 마스터만 삭제 */}
                    {!readOnly && <DeleteItemButton projectId={project} item={i} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-12 text-center text-secondary">
            {tp("projectFiles.empty")}
          </p>
        )}
      </div>
      {upload && (
        <FileUpload project={project} close={() => setUpload(false)} />
      )}
    </section>
  );
}
/** REQ-261016E — 문서 화면에서도 쓰도록 export. */
export function FileUpload({
  project,
  close,
}: {
  project: string;
  close: () => void;
}) {
  const qc = useQueryClient(),
    [file, setFile] = useState<File | null>(null),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [phase, setPhase] = useState("ETC"),
    [busy, setBusy] = useState(false),
    [attempted, setAttempted] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [operationId] = useState(() => crypto.randomUUID());
  // REQ-261016 — 저장소 선택: Drive 연결 전에는 ACM 저장소, 연결 후 선택(기본 Drive).
  const { t } = useTranslation("common");
  const { t: tp } = useTranslation("prj");
  const drive = useQuery({
    queryKey: ["prj-drive", ...useScope(), project],
    queryFn: async () =>
      (
        await apiClient.get<DriveStatus>("/acm/prj/drive", {
          params: { projectId: project },
        })
      ).data,
  });
  // FIX-261020C — 공용폴더가 없어도 이 프로젝트의 Drive 폴더가 있으면 Drive 로 올린다.
  const driveReady = !!(drive.data?.projectReady ?? drive.data?.rootReady);
  // REQ-261018C — 저장 위치 경로(공용 폴더 › 프로젝트 폴더) 표시
  const projectInfo = useQuery({
    queryKey: ["prj", "list", ...useScope()],
    queryFn: async () => (await apiClient.get<Project[]>("/acm/prj/projects")).data,
  }).data?.find((p) => p.prj_id === project);
  const [storage, setStorage] = useState<"DRIVE" | "ACM" | "">("");
  const chosen = storage || (driveReady ? "DRIVE" : "ACM");
  function choose(f?: File) {
    if (!f || attempted) return;
    setFile(f);
    setTitle(f.name.slice(0, 200));
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) close();
      }}
    >
      <DialogContent>
        <DialogTitle>{t("storagePath.uploadTitle")}</DialogTitle>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file) return;
            setBusy(true);
            setAttempted(true);
            setError("");
            try {
              const form = new FormData();
              form.append("file", file);
              form.append("title", title);
              form.append("description", description);
              form.append("phase", phase);
              form.append("operationId", operationId);
              form.append("storage", chosen);
              await apiClient.post(`/acm/prj/projects/${project}/files`, form, {
                timeout: 90000,
                onUploadProgress: (e) =>
                  setProgress(
                    Math.round((e.loaded / (e.total || file.size)) * 100),
                  ),
              });
              await qc.invalidateQueries({ queryKey: ["prj"] });
              close();
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="grid gap-1 text-sm" disabled={attempted}>
            <legend className="mb-1 font-medium">{t("drive.storage.label")}</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="storage"
                checked={chosen === "DRIVE"}
                disabled={!driveReady}
                onChange={() => setStorage("DRIVE")}
              />
              {t("drive.storage.drive")}
              {driveReady && (
                <span className="min-w-0 text-xs">
                  <StorageLocation
                    storage="DRIVE"
                    rootName={drive.data?.rootName}
                    folderName={projectInfo?.drive_folder_name ?? projectInfo?.prj_title}
                    folderId={projectInfo?.drive_folder_id}
                  />
                </span>
              )}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="storage"
                checked={chosen === "ACM"}
                onChange={() => setStorage("ACM")}
              />
              {t("drive.storage.acm")}
              <span className="text-xs text-secondary">{t("storagePath.acmHint")}</span>
            </label>
            {!driveReady && (
              <p className="text-xs text-secondary">
                {/* FIX-261020C — 연결돼 있지만 공용폴더만 없을 때는 그 사실을 알린다 */}
                {drive.data?.needsReconnect
                  ? t("drive.storage.reconnectHint")
                  : drive.data?.connected
                    ? `${t("drive.storage.rootMissingHint")} ${t(drive.data.canManage ? "drive.storage.rootMissingAdmin" : "drive.askAdmin")}`
                    : t("drive.storage.notConnectedHint")}
              </p>
            )}
          </fieldset>
          <label
            className="rounded border-2 border-dashed p-6"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              choose(e.dataTransfer.files[0]);
            }}
          >
            {t("storagePath.pick", { mb: 50 })}
            <input
              type="file"
              disabled={attempted}
              onChange={(e) => choose(e.target.files?.[0])}
            />
            {file && <span className="block text-sm">{file.name}</span>}
          </label>
          <label>
            {tp("fileUpload.title")}
            <input
              className="block w-full rounded border p-2"
              required
              maxLength={200}
              value={title}
              disabled={attempted}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            {tp("fileUpload.description")}
            <textarea
              className="block w-full rounded border p-2"
              maxLength={2000}
              value={description}
              disabled={attempted}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            {tp("common.phase")}
            <select
              className="block w-full rounded border p-2"
              value={phase}
              disabled={attempted}
              onChange={(e) => setPhase(e.target.value)}
            >
              {phases.map((v) => (
                <option key={v} value={v}>
                  {tp(`phase.${v}`)}
                </option>
              ))}
            </select>
          </label>
          {file && file.size > 50 * 1024 * 1024 && (
            <p role="alert" className="text-sm text-red-600">{t("storagePath.tooLarge", { mb: 50 })}</p>
          )}
          {error && <p role="alert">{error}</p>}
          <button
            className="rounded bg-accent-600 p-2 text-white"
            disabled={
              busy || !file || !title.trim() || file.size > 50 * 1024 * 1024
            }
          >
            {busy
              ? tp("fileUpload.uploading", { progress })
              : attempted
                ? tp("fileUpload.retry")
                : tp("fileUpload.submit")}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
