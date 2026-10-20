import { useTranslation } from "react-i18next";
import { FileUpload, phases } from "./project-files";
import { StorageLocation } from "./storage-location";
import { DeleteItemButton } from "./delete-item-button";
import { useAuthStore } from "@/stores/auth.store";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { projectDocumentPath } from "./document-page";
import { apiClient } from "@/lib/api-client";
import { CreateFile, useScope, errorText } from "./project-page";
import { documentKind } from "./project-overview";
import type { DriveStatus, Item, Project } from "./types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function DocumentsPage() {
  const { t } = useTranslation("common");
  const { t: tp } = useTranslation("prj");
  const user = useAuthStore((s) => s.user);
  const [role, setRole] = useState("");
  const [phase, setPhase] = useState("");
  const scope = useScope(),
    [params, setParams] = useSearchParams(),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("updated"),
    [share, setShare] = useState(""),
    [project, setProject] = useState(""),
    [creating, setCreating] = useState(false);
  const tab = params.get("tab") ?? "memo";
  const kind =
    tab === "spreadsheet"
      ? "SHEET"
      : tab === "gdoc"
        ? "DOC"
        : tab === "files"
          ? "FILE"
          : "MEMO";
  const q = useQuery({
    queryKey: ["prj", "documents", ...scope],
    queryFn: async () =>
      (
        await apiClient.get<(Item & { prj_id: string; prj_title: string })[]>(
          "/acm/prj/documents",
        )
      ).data,
  });
  const projects = useQuery({
    queryKey: ["prj", "list", ...scope],
    queryFn: async () =>
      (await apiClient.get<Project[]>("/acm/prj/projects")).data,
  });
  const rows = (q.data ?? [])
    .filter(
      (i) =>
        documentKind(i) === kind &&
        (!phase || kind !== "FILE" || i.file_phase === phase) &&
        (!role ||
          role ===
            (i.viewer_ids?.includes(user?.id ?? "") &&
            projects.data?.find((p) => p.prj_id === i.prj_id)?.owner_id !==
              user?.id
              ? "VIEWER"
              : "EDITOR")) &&
        (!project || i.prj_id === project) &&
        `${i.pit_title} ${i.prj_title} ${i.creator_name}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!share ||
          (share === "linked") === !!(i.external_url || i.drive_file_id)),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.pit_title.localeCompare(b.pit_title)
        : sort === "nameDesc"
          ? b.pit_title.localeCompare(a.pit_title)
          : sort === "downloads"
            ? (b.download_count ?? 0) - (a.download_count ?? 0)
            : sort === "size"
              ? Number(b.drive_size ?? 0) - Number(a.drive_size ?? 0)
              : sort === "created"
                ? b.created_at.localeCompare(a.created_at)
                : sort === "oldest"
                  ? a.updated_at.localeCompare(b.updated_at)
                  : b.updated_at.localeCompare(a.updated_at),
    );
  return (
    <section className="grid min-w-0 gap-5">
      <h1 className="text-2xl font-semibold">{tp("documentsPage.title")}</h1>
      <nav className="flex overflow-auto border-b">
        {[
          ["memo", "MEMO"],
          ["spreadsheet", "SHEET"],
          ["gdoc", "DOC"],
          ["files", "FILE"],
        ].map(([key, type]) => (
          <button
            key={key}
            className={`shrink-0 border-b-2 px-5 py-3 ${tab === key ? "border-blue-600 text-blue-600" : "border-transparent"}`}
            onClick={() => setParams({ tab: key })}
          >
            {tp(`docType.${type}`)}
          </button>
        ))}
      </nav>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label={tp("documentsPage.permission")}
          className="rounded border p-2"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">{tp("documentsPage.allPermissions")}</option>
          <option value="EDITOR">{tp("documentsPage.editor")}</option>
          <option value="VIEWER">{tp("documentsPage.viewer")}</option>
        </select>
        {kind === "FILE" && (
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
        )}
        <input
          className="min-w-0 rounded border p-2"
          aria-label={tp("documentsPage.search")}
          placeholder={tp("documentsPage.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label={tp("common.sort")}
          className="rounded border p-2"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updated">{tp("documentsPage.sortUpdated")}</option>
          <option value="oldest">{tp("documentsPage.sortOldest")}</option>
          <option value="created">{tp("common.sortRecentCreated")}</option>
          <option value="name">{tp("documentsPage.sortNameAsc")}</option>
          <option value="nameDesc">{tp("documentsPage.sortNameDesc")}</option>
          {kind === "FILE" && (
            <>
              <option value="size">{tp("common.sortSize")}</option>
              <option value="downloads">{tp("common.sortDownloads")}</option>
            </>
          )}
        </select>
        <select
          aria-label={tp("documentsPage.project")}
          className="rounded border p-2"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="">{tp("documentsPage.allProjects")}</option>
          {projects.data?.map((p) => (
            <option key={p.prj_id} value={p.prj_id}>
              {p.prj_title}
            </option>
          ))}
        </select>
        <select
          aria-label={tp("documentsPage.linkStatus")}
          className="rounded border p-2"
          value={share}
          onChange={(e) => setShare(e.target.value)}
        >
          <option value="">{tp("documentsPage.allLinkStatuses")}</option>
          <option value="linked">{tp("documentsPage.googleLinked")}</option>
          <option value="local">{tp("documentsPage.acmStored")}</option>
        </select>
        {/* REQ-261016E — 문서 화면에서 바로 작성: 프로젝트·종류·방식 선택 */}
        <button
          type="button"
          className="rounded bg-accent-600 p-2 text-white"
          onClick={() => setCreating(true)}
        >
          + {t("docsCreate.title")}
        </button>
      </div>
      {creating && (
        <NewDocumentDialog
          projects={(projects.data ?? []).filter((p) => p.prj_status !== "ARCHIVED")}
          initialProject={project}
          initialKind={kind}
          close={() => setCreating(false)}
        />
      )}
      {q.error && <p role="alert">{errorText(q.error)}</p>}
      <div className="overflow-x-auto rounded-xl border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              {[
                t("storagePath.cols.title"),
                t("storagePath.cols.project"),
                // REQ-261018C — 파일은 실제 저장 위치를 보여준다.
                ...(kind === "FILE" ? [t("storagePath.cols.location")] : []),
                t("storagePath.cols.updated"),
                t("storagePath.cols.author"),
                kind === "FILE" ? t("storagePath.cols.size") : t("storagePath.cols.mode"),
                t("storagePath.cols.actions"),
              ].map((h) => (
                <th className="whitespace-nowrap px-4 py-3" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr className="border-b hover:bg-gray-50" key={i.pit_id}>
                <td className="max-w-xs px-4 py-3">
                  <Link
                    className="text-blue-600"
                    to={
                      kind !== "FILE" && !i.drive_file_id
                        ? projectDocumentPath(i.prj_id, i.pit_id, kind)
                        : `/admin/projects/${i.prj_id}?tab=documents&type=${kind.toLowerCase()}&doc=${i.pit_id}`
                    }
                  >
                    {i.pit_title}
                  </Link>
                </td>
                <td className="px-4 py-3">{i.prj_title}</td>
                {kind === "FILE" && (
                  <td className="max-w-[18rem] px-4 py-3 text-xs">
                    <StorageLocation
                      storage={i.storage_type === "LOCAL" ? "ACM" : "DRIVE"}
                      rootName={i.drive_root_name}
                      folderName={i.prj_drive_folder_name ?? i.prj_title}
                      folderId={i.prj_drive_folder_id}
                    />
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3">
                  {new Date(i.updated_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">{i.creator_name}</td>
                <td className="px-4 py-3">
                  {kind === "FILE"
                    ? `${Math.ceil(Number(i.drive_size ?? 0) / 1024)}KB`
                    : i.external_url || i.drive_file_id
                      ? tp("documentsPage.googleLinked")
                      : tp("documentsPage.acmDocument")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyId id={i.pit_id} />
                    {/* REQ-261019 — 작성자·프로젝트 담당자·테넌트 마스터 */}
                    <DeleteItemButton projectId={i.prj_id} item={i} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-12 text-center text-secondary">
            {q.isLoading ? tp("common.loading") : tp("common.noItems")}
          </p>
        )}
      </div>
    </section>
  );
}
function CopyId({ id }: { id: string }) {
  const { t: tp } = useTranslation("prj");
  const [message, setMessage] = useState("");
  return (
    <button
      onClick={() =>
        void navigator.clipboard.writeText(id).then(
          () => setMessage(tp("documentsPage.copied")),
          () => setMessage(tp("documentsPage.copyFailed")),
        )
      }
    >
      {message || tp("documentsPage.copyId")}
    </button>
  );
}

type DocKind = "MEMO" | "SHEET" | "DOC" | "FILE";
type Method = "LOCAL" | "GOOGLE_LINK" | "GOOGLE_NEW" | "UPLOAD";
const KINDS: DocKind[] = ["MEMO", "SHEET", "DOC", "FILE"];
const METHODS: Record<DocKind, Method[]> = {
  MEMO: ["LOCAL"],
  SHEET: ["LOCAL", "GOOGLE_LINK", "GOOGLE_NEW"],
  DOC: ["LOCAL", "GOOGLE_LINK", "GOOGLE_NEW"],
  FILE: ["UPLOAD"],
};

/**
 * REQ-261016E — /admin/documents 에서 바로 작성. 프로젝트·종류·방식을 고르면
 * 프로젝트 화면과 같은 작성 경로(ACM 편집기, Google 링크, Google 새로 만들기, 파일 업로드)로 간다.
 */
function NewDocumentDialog({
  projects,
  initialProject,
  initialKind,
  close,
}: {
  projects: Project[];
  initialProject: string;
  initialKind: DocKind;
  close: () => void;
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const scope = useScope();
  const [prj, setPrj] = useState(
    projects.some((p) => p.prj_id === initialProject) ? initialProject : (projects[0]?.prj_id ?? ""),
  );
  const [kind, setKind] = useState<DocKind>(initialKind);
  const [method, setMethod] = useState<Method>(METHODS[initialKind][0]);
  const [step, setStep] = useState<"pick" | "google" | "upload">("pick");
  const drive = useQuery({
    queryKey: ["prj-drive", ...scope],
    queryFn: async () => (await apiClient.get<DriveStatus>("/acm/prj/drive")).data,
  });
  const driveReady = !!drive.data?.rootReady;
  if (step === "google")
    return <CreateFile project={prj} documents initialKind={kind === "SHEET" ? "SHEET" : "DOCUMENT"} close={close} />;
  if (step === "upload") return <FileUpload project={prj} close={close} />;
  const next = () => {
    if (method === "LOCAL" || method === "GOOGLE_LINK") {
      close();
      navigate(projectDocumentPath(prj, "new", kind, method));
    } else setStep(method === "GOOGLE_NEW" ? "google" : "upload");
  };
  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("docsCreate.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 text-sm">
          <label className="grid gap-1">
            <span className="font-medium">{t("docsCreate.project")}</span>
            <select className="rounded border p-2" value={prj} onChange={(e) => setPrj(e.target.value)}>
              {!projects.length && <option value="">{t("docsCreate.noProject")}</option>}
              {projects.map((p) => (
                <option key={p.prj_id} value={p.prj_id}>
                  {p.prj_code ? `[${p.prj_code}] ` : ""}
                  {p.prj_title}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="grid gap-1">
            <legend className="mb-1 font-medium">{t("docsCreate.kind")}</legend>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <label
                  key={k}
                  className={`cursor-pointer rounded-full border px-3 py-1 ${kind === k ? "border-accent-500 bg-accent-50 text-accent-700" : "text-secondary"}`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name="doc-kind"
                    checked={kind === k}
                    onChange={() => {
                      setKind(k);
                      setMethod(METHODS[k][0]);
                    }}
                  />
                  {t(`docsCreate.kinds.${k}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 font-medium">{t("docsCreate.method")}</legend>
            {METHODS[kind].map((m) => {
              const disabled = m === "GOOGLE_NEW" && !driveReady;
              return (
                <label key={m} className={`flex items-center gap-2 ${disabled ? "text-gray-400" : ""}`}>
                  <input
                    type="radio"
                    name="doc-method"
                    disabled={disabled}
                    checked={method === m}
                    onChange={() => setMethod(m)}
                  />
                  {t(`docsCreate.methods.${m}`)}
                  {disabled && (
                    <Link to="/admin/config/drive" className="text-xs text-accent-700 underline">
                      {t("docsCreate.driveRequired")}
                    </Link>
                  )}
                </label>
              );
            })}
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>
              {t("docsCreate.cancel")}
            </Button>
            <Button disabled={!prj} onClick={next}>
              {t("docsCreate.next")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
