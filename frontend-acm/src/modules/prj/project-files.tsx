import { useAuthStore } from "@/stores/auth.store";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { errorText, useScope } from "./project-page";
import type { DriveStatus, Item } from "./types";
export const phases: Record<string, string> = {
  PLANNING: "기획",
  DESIGN: "디자인",
  DEVELOPMENT: "개발",
  OPERATION: "운영",
  ETC: "기타",
};
export function ProjectFiles({
  project,
  items,
  readOnly,
}: {
  project: string;
  items: Item[];
  readOnly: boolean;
}) {
  const user = useAuthStore((s) => s.user);
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
          aria-label="파일 검색"
          placeholder="파일명·설명·업로더 검색"
          className="rounded border p-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="파일 정렬"
          className="rounded border p-2"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="created">최근 등록순</option>
          <option value="oldest">오래된 등록순</option>
          <option value="name">이름순</option>
          <option value="size">크기순</option>
          <option value="downloads">다운로드 수순</option>
        </select>
        <select
          aria-label="단계"
          className="rounded border p-2"
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
        >
          <option value="">전체 단계</option>
          {Object.entries(phases).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {!readOnly && (
          <button
            className="rounded bg-blue-600 px-3 py-2 text-white"
            onClick={() => setUpload(true)}
          >
            + 파일 업로드
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
                "파일명",
                "설명",
                "단계",
                "업로더",
                "등록일",
                "크기",
                "다운로드",
                "작업",
              ].map((v) => (
                <th className="whitespace-nowrap p-3" key={v}>
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr className="border-t" key={i.pit_id}>
                <td className="p-3">{i.pit_title}</td>
                <td className="p-3">{i.pit_body || "-"}</td>
                <td className="p-3">{phases[i.file_phase ?? "ETC"]}</td>
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
                      다운로드
                    </button>
                    {!readOnly && !i.viewer_ids?.includes(user?.id ?? "") && (
                      <button
                        className="text-red-600"
                        onClick={async () => {
                          if (
                            !confirm(
                              "목록에서 제거할까요? 원본 파일은 보존됩니다.",
                            )
                          )
                            return;
                          try {
                            await apiClient.delete(
                              `/acm/prj/projects/${project}/items/${i.pit_id}/link`,
                            );
                            await qc.invalidateQueries({ queryKey: ["prj"] });
                          } catch (e) {
                            setError(errorText(e));
                          }
                        }}
                      >
                        제거
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-12 text-center text-secondary">
            등록된 파일이 없습니다.
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
  const drive = useQuery({
    queryKey: ["prj-drive", ...useScope()],
    queryFn: async () =>
      (await apiClient.get<DriveStatus>("/acm/prj/drive")).data,
  });
  const driveReady = !!drive.data?.rootReady;
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
        <DialogTitle>파일 업로드</DialogTitle>
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
              {driveReady && drive.data?.rootName && (
                <span className="text-secondary">({drive.data.rootName})</span>
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
            </label>
            {!driveReady && (
              <p className="text-xs text-secondary">
                {drive.data?.needsReconnect
                  ? t("drive.storage.reconnectHint")
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
            파일 선택 또는 끌어 놓기 (최대 20MB)
            <input
              type="file"
              disabled={attempted}
              onChange={(e) => choose(e.target.files?.[0])}
            />
            {file && <span className="block text-sm">{file.name}</span>}
          </label>
          <label>
            제목
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
            설명
            <textarea
              className="block w-full rounded border p-2"
              maxLength={2000}
              value={description}
              disabled={attempted}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            단계
            <select
              className="block w-full rounded border p-2"
              value={phase}
              disabled={attempted}
              onChange={(e) => setPhase(e.target.value)}
            >
              {Object.entries(phases).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {error && <p role="alert">{error}</p>}
          <button
            className="rounded bg-blue-600 p-2 text-white"
            disabled={
              busy || !file || !title.trim() || file.size > 20 * 1024 * 1024
            }
          >
            {busy
              ? `업로드 ${progress}% · 저장 확인 중…`
              : attempted
                ? "결과 확인 / 재시도"
                : "등록"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
