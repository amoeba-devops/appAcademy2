import { DeleteItemButton } from "./delete-item-button";
import { DocumentTable } from "./document-table";
import { DocumentPermissions } from "./document-permissions";
import { ProjectFiles } from "./project-files";
import { ProjectOverview } from "./project-overview";
import { projectDocumentPath } from "./document-page";
import { DriveConnection } from "./drive-connection";
import { IssueFormDialog } from "./issues/issue-form-dialog";
import { IssueKanban } from "./issues/issue-kanban";
import { isBlankHtml, plainText } from "./issues/issue-rich-text";
import type { Issue } from "./issues/issue-model";
import {
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FolderKanban } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { useConfigAccess } from "@/modules/cfg/hooks/use-config-access";
import { AdminSupportSlot } from "@/components/layout/admin-content-layout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { UnderlineTabs } from "@/components/ui/tabs";
import { pickGoogle } from "./google-picker";
import {
  type Project,
  type Item,
  type Person,
  type DriveStatus,
  type DriveFile,
  statusName,
} from "./types";
const base = "/acm/prj";
const input = "w-full min-w-0 rounded border bg-surface p-2 text-base";
export function errorText(e: unknown) {
  const x = e as {
    response?: { data?: { message?: string; error?: { message?: string } } };
    message?: string;
  };
  return (
    x.response?.data?.error?.message ??
    x.response?.data?.message ??
    x.message ??
    i18next.t("prj:common.requestFailed")
  );
}
export function useScope() {
  const u = useAuthStore((s) => s.user);
  return [u?.entId, u?.id];
}
export function useWork() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}
function Notice({ text }: { text?: string }) {
  return text ? (
    <p
      role="alert"
      className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700"
    >
      {text}
    </p>
  ) : null;
}
function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      {title}
      {children}
    </label>
  );
}
export function ProjectListPage() {
  const { t: tc } = useTranslation("common");
  const { t: tp } = useTranslation("prj");
  const q = useQuery({
    queryKey: ["prj", ...useScope()],
    queryFn: async () =>
      (await apiClient.get<Project[]>(base + "/projects")).data,
  });
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [mine, setMine] = useState(false),
    [sort, setSort] = useState("updated"),
    [edit, setEdit] = useState(false);
  const user = useAuthStore((s) => s.user);
  const rows = (q.data ?? [])
    .filter(
      (p) =>
        p.prj_title.toLowerCase().includes(search.toLowerCase()) &&
        (status ? p.prj_status === status : p.prj_status !== "ARCHIVED") &&
        (!mine || p.owner_id === user?.id),
    )
    .sort((a, b) =>
      sort === "issues"
        ? (b.issue_count ?? 0) - (a.issue_count ?? 0)
        : b.updated_at.localeCompare(a.updated_at),
    );
  return (
    <section className="min-w-0">
      <PageHeader
        icon={FolderKanban}
        title={tc("nav.projects")}
        description={tc("pageHeader.projects.desc")}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/drive">{tc("pageHeader.projects.driveConnect")}</Link>
            </Button>
            <Button onClick={() => setEdit(true)}>
              + {tc("pageHeader.projects.create")}
            </Button>
          </>
        }
        tabs={
          <UnderlineTabs
            items={[
              { key: "joined", label: tc("pageHeader.projects.joined") },
              { key: "owned", label: tc("pageHeader.projects.owned") },
            ]}
            value={mine ? "owned" : "joined"}
            onChange={(key) => setMine(key === "owned")}
          />
        }
      />
      <div className="grid min-w-0 gap-4">
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label={tp("projectList.search")}
            placeholder={tp("projectList.search")}
            className="max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label={tp("projectList.statusFilter")}
            className={input + " !w-auto"}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{tp("projectList.allExceptArchived")}</option>
            <option value="ACTIVE">{tp("status.ACTIVE")}</option>
            <option value="DONE">{tp("status.DONE")}</option>
            <option value="ARCHIVED">{tp("projectList.archiveBox")}</option>
          </select>
          <select
            aria-label={tp("common.sort")}
            className={input + " !w-auto"}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="updated">{tp("projectList.sortUpdated")}</option>
            <option value="issues">{tp("projectList.sortIssues")}</option>
          </select>
        </div>
        <Notice text={q.error ? errorText(q.error) : ""} />
        {q.isLoading ? (
          <p>{tp("common.loading")}</p>
        ) : !rows.length ? (
          <p>{tp("projectList.empty")}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((p) => (
              <Link
                key={p.prj_id}
                to={"/admin/projects/" + p.prj_id}
                className="min-w-0 rounded-lg border bg-surface p-4 hover:border-blue-400"
              >
                <div className="flex justify-between gap-2 text-xs text-secondary">
                  <span>PRJ-{p.prj_id.slice(0, 8)}</span>
                  <span className="flex items-center gap-1.5">
                    {p.is_member === false && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                        {tp("projectList.notMember")}
                      </span>
                    )}
                    {statusName(p.prj_status)}
                  </span>
                </div>
                <h2 className="my-3 break-words text-lg font-semibold">
                  {p.prj_title}
                </h2>
                <p className="text-sm">
                  {tp("projectList.cardSummary", {
                    members: p.member_count,
                    issues: p.issue_count,
                  })}
                </p>
                <ul className="mt-3 grid gap-1 text-sm">
                  {p.recent_issues?.map((i, n) => (
                    <li className="truncate" key={n}>
                      {statusName(i.pit_status)} · {i.pit_title}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-secondary">
                  {tp("projectList.updatedAt", {
                    date: new Date(p.updated_at).toLocaleDateString(),
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
        {edit && <ProjectEditor close={() => setEdit(false)} />}
      </div>
    </section>
  );
}
function ProjectEditor({
  project,
  close,
}: {
  project?: Project;
  close: () => void;
}) {
  const user = useAuthStore((s) => s.user),
    qc = useQueryClient(),
    nav = useNavigate(),
    w = useWork();
  const { t: tp } = useTranslation("prj");
  const [title, setTitle] = useState(project?.prj_title ?? ""),
    [description, setDescription] = useState(project?.prj_description ?? ""),
    [owner, setOwner] = useState(project?.owner_id ?? user?.id ?? ""),
    [members, setMembers] = useState(project?.members?.map((m) => m.id) ?? []),
    [status, setStatus] = useState(project?.prj_status ?? "ACTIVE");
  const [managers, setManagers] = useState(
    project?.members
      ?.filter((m) => m.member_role === "MANAGER")
      .map((m) => m.id) ?? [],
  );
  const people = useQuery({
    queryKey: ["prj-people", ...useScope()],
    queryFn: async () => (await apiClient.get<Person[]>(base + "/people")).data,
  });
  const save = (e: FormEvent) => {
    e.preventDefault();
    void w.run(async () => {
      const payload = {
        title,
        description,
        ownerId: owner,
        memberIds: members,
        managerIds: managers.filter(
          (id) => members.includes(id) || id === owner,
        ),
        status,
      };
      const r = project
        ? await apiClient.put<Project>(
            base + "/projects/" + project.prj_id,
            payload,
          )
        : await apiClient.post<Project>(base + "/projects", payload);
      await qc.invalidateQueries({ queryKey: ["prj"] });
      close();
      nav("/admin/projects/" + r.data.prj_id);
    });
  };
  return (
    <Dialog open onOpenChange={(v) => !v && !w.busy && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {project
              ? tp("projectEditor.titleEdit")
              : tp("projectEditor.titleCreate")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <Field title={tp("projectEditor.name")}>
            <Input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field title={tp("projectEditor.description")}>
            <textarea
              className={input}
              maxLength={10000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field title={tp("projectEditor.owner")}>
            <select
              required
              className={input}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">{tp("common.select")}</option>
              {people.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="max-h-36 overflow-auto rounded border p-2">
            <legend>{tp("projectEditor.managers")}</legend>
            {people.data
              ?.filter((p) => members.includes(p.id) && p.id !== owner)
              .map((p) => (
                <label className="flex gap-2 p-2" key={p.id}>
                  <input
                    type="checkbox"
                    checked={managers.includes(p.id)}
                    onChange={(e) =>
                      setManagers((v) =>
                        e.target.checked
                          ? [...v, p.id]
                          : v.filter((id) => id !== p.id),
                      )
                    }
                  />
                  {p.name}
                </label>
              ))}
          </fieldset>
          <fieldset className="max-h-44 overflow-y-auto rounded border p-2">
            <legend>{tp("projectEditor.members")}</legend>
            {people.data?.map((p) => (
              <label key={p.id} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={members.includes(p.id) || p.id === owner}
                  onChange={(e) =>
                    setMembers(
                      e.target.checked
                        ? [...members, p.id]
                        : members.filter((id) => id !== p.id),
                    )
                  }
                />
                {p.name}
              </label>
            ))}
          </fieldset>
          {project && (
            <Field title={tp("projectEditor.status")}>
              <select
                className={input}
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as Project["prj_status"])
                }
              >
                {["ACTIVE", "DONE", "ARCHIVED"].map((s) => (
                  <option key={s} value={s}>
                    {statusName(s)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Notice
            text={w.error || (people.error ? errorText(people.error) : "")}
          />
          <Button disabled={w.busy || people.isLoading} type="submit">
            {w.busy ? tp("common.saving") : tp("common.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function DriveConnectionPage() {
  const { t: tp } = useTranslation("prj");
  return (
    <section className="grid gap-4">
      <h1 className="text-xl font-bold">{tp("driveConnectionPage.title")}</h1>
      <DriveConnection />
      <Link to="/admin/projects" className="underline">
        {tp("driveConnectionPage.back")}
      </Link>
    </section>
  );
}
// REQ-261016 — 회사 Workspace 연동 패널은 drive-connection.tsx 로 이동.
export { DriveConnection };
export function ProjectDetailPage() {
  const { t } = useTranslation("common");
  const { t: tp } = useTranslation("prj");
  const { id = "" } = useParams(),
    [params, setParams] = useSearchParams(),
    qc = useQueryClient(),
    w = useWork(),
    slot = useContext(AdminSupportSlot);
  const user = useAuthStore((s) => s.user);
  // PLN-261027B — 서비스 관리자(관리자 + 서비스 운영자/테넌트 마스터)만 프로젝트 삭제.
  const canDeleteProject = useConfigAccess().deleteAllowed;
  const [deleting, setDeleting] = useState(false);
  const oldTab = params.get("tab");
  const tab =
    oldTab === "notes" || oldTab === "files"
      ? "documents"
      : (oldTab ?? "overview");
  const requestedType =
    oldTab === "notes"
      ? "MEMO"
      : oldTab === "files"
        ? "FILE"
        : (params.get("type") ?? "memo").toUpperCase();
  const docType = ["MEMO", "SHEET", "DOC", "FILE"].includes(requestedType)
    ? requestedType
    : "MEMO";
  const navigate = useNavigate(),
    openDoc = (doc: Item | "new", mode?: "LOCAL" | "GOOGLE_LINK") =>
      navigate(
        projectDocumentPath(
          id,
          doc === "new" ? "new" : doc.pit_id,
          docType,
          doc === "new" ? mode : undefined,
        ),
      );
  const [editing, setEditing] = useState(false),
    [itemEdit, setItemEdit] = useState<Item | "new" | null>(null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [assignee, setAssignee] = useState(""),
    [driveModal, setDriveModal] = useState(false),
    [newDoc, setNewDoc] = useState(false);
  // REQ-261016D — 이슈 탭 목록/칸반 전환(브라우저에 기억)
  const [issueView, setIssueView] = useState<"list" | "kanban">(() => {
    try {
      return localStorage.getItem("acm-project-issue-view") === "kanban" ? "kanban" : "list";
    } catch {
      return "list";
    }
  });
  const switchIssueView = (v: "list" | "kanban") => {
    setIssueView(v);
    try {
      localStorage.setItem("acm-project-issue-view", v);
    } catch {
      /* ignore */
    }
  };
  const p = useQuery({
    queryKey: ["prj", id, ...useScope()],
    queryFn: async () =>
      (await apiClient.get<Project>(base + "/projects/" + id)).data,
  });
  const items = useQuery({
    queryKey: ["prj", id, "items", ...useScope()],
    queryFn: async () =>
      (await apiClient.get<Item[]>(base + "/projects/" + id + "/items")).data,
  });
  const drive = useQuery({
    queryKey: ["prj-drive", ...useScope(), id],
    queryFn: async () =>
      (
        await apiClient.get<DriveStatus>(base + "/drive", {
          params: { projectId: id },
        })
      ).data,
  });
  // FIX-261020C — 공용폴더가 없어도 이 프로젝트의 Drive 폴더가 있으면 사용 가능
  const driveReady = !!(drive.data?.projectReady ?? drive.data?.rootReady);
  useEffect(() => {
    const doc = params.get("doc");
    const found = items.data?.find((i) => i.pit_id === doc);
    if (found && !found.drive_file_id && found.pit_kind !== "FILE") {
      navigate(projectDocumentPath(id, found.pit_id, docType), {
        replace: true,
      });
      return;
    }
    if (params.get("create") === "1") {
      if (docType !== "FILE") {
        navigate(projectDocumentPath(id, "new", docType), { replace: true });
        return;
      }
      const next = new URLSearchParams(params);
      next.delete("create");
      setParams(next, { replace: true });
    }
  }, [params, items.data, docType, setParams, navigate, id]);
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["prj"] });
  };
  const removeProject = async () => {
    setDeleting(true);
    try {
      const n = (
        await apiClient.get<{ issues: number; files: number; documents: number }>(
          base + "/projects/" + id + "/counts",
        )
      ).data;
      if (
        !window.confirm(
          tp("projectDetail.deleteConfirm", { title: p.data?.prj_title ?? "", ...n }),
        )
      )
        return;
      await apiClient.delete(base + "/projects/" + id);
      await qc.invalidateQueries({ queryKey: ["prj"] });
      navigate("/admin/projects");
    } catch (e) {
      window.alert(errorText(e));
    } finally {
      setDeleting(false);
    }
  };
  if (p.isLoading) return <p>{tp("common.loading")}</p>;
  if (!p.data)
    return (
      <Notice
        text={p.error ? errorText(p.error) : tp("common.noProject")}
      />
    );
  const project = p.data,
    manage = project.can_manage ?? project.owner_id === user?.id,
    readOnly = project.prj_status === "ARCHIVED";
  const info = (
    <div className="grid gap-3">
      <h2 className="font-semibold">{tp("projectDetail.infoTitle")}</h2>
      <p>{statusName(project.prj_status)}</p>
      <h3>
        {tp("projectDetail.memberCount", { n: project.members?.length ?? "" })}
      </h3>
      {project.members?.map((m) => (
        <p key={m.id}>
          {m.id === project.owner_id ? "👑 " : ""}
          {m.name}
        </p>
      ))}
      {manage && (
        <Button variant="outline" onClick={() => setEditing(true)}>
          {tp("projectDetail.manageMembers")}
        </Button>
      )}
    </div>
  );
  const kind =
    tab === "documents"
      ? docType === "MEMO"
        ? "NOTE"
        : docType === "FILE"
          ? "FILE"
          : "DOCUMENT"
      : "ISSUE";
  const classify = (i: Item) =>
    i.document_type ??
    (i.pit_kind === "NOTE"
      ? "MEMO"
      : i.pit_kind === "FILE"
        ? "FILE"
        : i.drive_mime?.includes("spreadsheet")
          ? "SHEET"
          : "DOC");
  const rows = (items.data ?? []).filter(
    (i) =>
      i.pit_kind === kind &&
      (tab !== "documents" || classify(i) === docType) &&
      i.pit_title.toLowerCase().includes(search.toLowerCase()) &&
      (!filter || i.pit_status === filter) &&
      (!assignee || i.assignee_id === assignee),
  );
  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        back={{ to: "/admin/projects", label: t("nav.projects") }}
        title={project.prj_title}
        description={
          project.prj_description ? (
            <span className="whitespace-pre-wrap break-words">
              {project.prj_description}
            </span>
          ) : undefined
        }
        meta={
          <span>
            {project.prj_code ?? `PRJ-${id.slice(0, 8)}`} ·{" "}
            {statusName(project.prj_status)}
          </span>
        }
        actions={
          <>
            {manage && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                {t("pageHeader.projectDetail.edit")}
              </Button>
            )}
            {canDeleteProject && (
              <Button
                variant="outline"
                disabled={deleting}
                className="text-red-600 hover:bg-red-50"
                onClick={() => void removeProject()}
              >
                {tp("projectDetail.delete")}
              </Button>
            )}
            <Button variant="outline" onClick={() => slot?.show()}>
              {t("pageHeader.projectDetail.info")}
            </Button>
          </>
        }
        tabs={
          <UnderlineTabs
            items={(
              [
                ["overview", ""],
                ["documents", "DOCUMENT"],
                ["issues", "ISSUE"],
              ] as const
            ).map(([key, k]) => ({
              key,
              label: t(`pageHeader.projectDetail.tabs.${key}`),
              count: k
                ? (items.data ?? []).filter((i) =>
                    key === "documents"
                      ? i.pit_kind !== "ISSUE"
                      : i.pit_kind === k,
                  ).length
                : undefined,
            }))}
            value={tab as "overview" | "documents" | "issues"}
            onChange={(key) => {
              setParams({ tab: key });
              setFilter("");
              setAssignee("");
              setSearch("");
            }}
          />
        }
      />
      {slot?.target ? createPortal(info, slot.target) : null}
      <Notice text={w.error || (items.error ? errorText(items.error) : "")} />
      {readOnly && (
        <p>
          {tp("projectDetail.archivedNotice")}
        </p>
      )}
      {tab === "overview" ? (
        <ProjectOverview
          project={project}
          items={items.data ?? []}
          manage={manage}
          onManage={() => setEditing(true)}
          onBrowse={(type) =>
            setParams({ tab: "documents", type: type.toLowerCase() })
          }
        />
      ) : (
        <>
          {tab === "documents" && (
            <nav
              aria-label={tp("projectDetail.docCategory")}
              className="flex min-w-0 gap-2 overflow-x-auto"
            >
              {["MEMO", "SHEET", "DOC", "FILE"].map((value) => (
                <Button
                  key={value}
                  className="shrink-0"
                  variant={docType === value ? "default" : "outline"}
                  onClick={() => {
                    setParams({ tab: "documents", type: value.toLowerCase() });
                    setFilter("");
                    setSearch("");
                    setAssignee("");
                  }}
                >
                  {tp(`docType.${value}`)}
                </Button>
              ))}
            </nav>
          )}
          {kind === "FILE" ? (
            <ProjectFiles
              project={id}
              items={items.data ?? []}
              readOnly={readOnly}
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-xs"
                  aria-label={tp("projectDetail.searchTitle")}
                  placeholder={tp("projectDetail.searchTitle")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {kind === "ISSUE" && (
                  <>
                    <div className="inline-flex rounded border p-0.5" role="tablist">
                      {(["list", "kanban"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          role="tab"
                          aria-selected={issueView === v}
                          onClick={() => switchIssueView(v)}
                          className={
                            "rounded px-3 py-1 text-sm " +
                            (issueView === v ? "bg-accent-50 text-accent-700" : "text-secondary")
                          }
                        >
                          {t(`issues.view.${v}`)}
                        </button>
                      ))}
                    </div>
                    <select
                      aria-label={tp("projectDetail.issueStatus")}
                      className={input + " !w-auto"}
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="">{tp("projectDetail.allStatuses")}</option>
                      {["OPEN", "IN_PROGRESS", "DONE", "REJECTED"].map((s) => (
                        <option key={s} value={s}>
                          {statusName(s)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={tp("projectDetail.assigneeFilter")}
                      className={input + " !w-auto"}
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                    >
                      <option value="">{tp("projectDetail.allAssignees")}</option>
                      {project.members?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {!readOnly &&
                  (kind === "ISSUE" ? (
                    <Button onClick={() => setItemEdit("new")}>
                      + {tp("projectDetail.newIssue")}
                    </Button>
                  ) : (
                    <>
                      {docType !== "FILE" && (
                        <Button
                          onClick={() => {
                            openDoc("new", "LOCAL");
                          }}
                        >
                          +{" "}
                          {docType === "SHEET"
                            ? tp("projectDetail.newSheet")
                            : docType === "DOC"
                              ? tp("projectDetail.newAcmDoc")
                              : tp("projectDetail.newMemo")}
                        </Button>
                      )}
                      {(docType === "SHEET" || docType === "DOC") && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            openDoc("new", "GOOGLE_LINK");
                          }}
                        >
                          {docType === "SHEET"
                            ? tp("projectDetail.linkGoogleSheet")
                            : tp("projectDetail.linkGoogleDoc")}
                        </Button>
                      )}
                      {(docType === "FILE" ||
                        docType === "DOC" ||
                        docType === "SHEET") && (
                        // FIX-261016C — Drive 공용폴더가 없으면 Google 생성/업로드를 막고 안내한다.
                        <Button
                          variant="outline"
                          disabled={!driveReady}
                          title={driveReady ? undefined : t("drive.notReadyHint")}
                          onClick={() => setNewDoc(true)}
                        >
                          {docType === "FILE"
                            ? tp("projectDetail.uploadOrFolder")
                            : tp("projectDetail.createInGoogle")}
                        </Button>
                      )}
                      {(docType === "FILE" ||
                        docType === "DOC" ||
                        docType === "SHEET") &&
                        drive.data &&
                        !driveReady && (
                          <p className="w-full text-xs text-secondary">
                            {t(
                              drive.data.needsReconnect
                                ? "drive.storage.reconnectHint"
                                : "drive.notReadyHint",
                            )}{" "}
                            {drive.data.canManage ? (
                              <Link className="underline" to="/admin/config/drive">
                                {t("drive.goSettings")}
                              </Link>
                            ) : (
                              t("drive.askAdmin")
                            )}
                          </p>
                        )}
                      {docType === "FILE" && (
                        <Button
                          variant="outline"
                          onClick={() => setDriveModal(true)}
                        >
                          {tp("projectDetail.browseFiles")}
                        </Button>
                      )}
                      {docType === "FILE" && drive.data?.canManage && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            void w.run(async () => {
                              const fileId = await pickGoogle();
                              if (fileId) {
                                await apiClient.post(
                                  base + "/projects/" + id + "/drive/link",
                                  { fileId },
                                );
                                await refresh();
                              }
                            })
                          }
                        >
                          {tp("projectDetail.linkDriveFile")}
                        </Button>
                      )}
                    </>
                  ))}
                <Button variant="outline" onClick={() => void refresh()}>
                  {tp("projectDetail.refresh")}
                </Button>
              </div>
              {items.isLoading ? (
                <p>{tp("common.loading")}</p>
              ) : !rows.length ? (
                <p>{tp("common.noItems")}</p>
              ) : kind !== "ISSUE" ? (
                <DocumentTable
                  items={rows}
                  project={project}
                  manage={manage}
                  onEdit={openDoc}
                />
              ) : issueView === "kanban" ? (
                <IssueKanban
                  showProject={false}
                  readOnly={readOnly}
                  items={rows.map((i) => ({
                    ...i,
                    pit_ref_no: i.pit_ref_no ?? null,
                    pit_issue_type: i.pit_issue_type ?? "TASK",
                    pit_priority: i.pit_priority ?? 3,
                    assignee_name: project.members?.find((m) => m.id === i.assignee_id)?.name ?? null,
                  }))}
                  onMove={(issueId, next) =>
                    void w.run(async () => {
                      await apiClient.patch(`${base}/issues/${issueId}/status`, { status: next });
                      await refresh();
                    })
                  }
                />
              ) : (
                <div className="grid gap-3">
                  {rows.map((i) => (
                    <article
                      key={i.pit_id}
                      className="grid min-w-0 gap-2 rounded-lg border bg-surface p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0">
                        <h2 className="break-words font-semibold">
                          {i.pit_title}
                        </h2>
                        <p className="text-xs text-secondary">
                          {i.creator_name} ·{" "}
                          {new Date(i.updated_at).toLocaleDateString()}{" "}
                          {i.pit_kind === "ISSUE"
                            ? `· ${statusName(i.pit_status)} · ${project.members?.find((m) => m.id === i.assignee_id)?.name ?? tp("common.unassigned")} · ${i.due_date ?? tp("projectDetail.noDue")}`
                            : i.drive_mime?.includes("spreadsheet")
                              ? `· ${tp("projectDetail.googleSheet")}`
                              : i.drive_mime?.includes("document")
                                ? `· ${tp("projectDetail.googleDoc")}`
                                : ""}
                        </p>
                        {!isBlankHtml(i.pit_body) && (
                          // REQ-261016D — HTML 설명은 태그를 뺀 텍스트로 미리보기
                          <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm">
                            {plainText(i.pit_body)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        {manage && i.pit_kind !== "ISSUE" && (
                          <DocumentPermissions project={project} item={i} />
                        )}
                        {i.drive_file_id ? (
                          <>
                            <Button
                              disabled={w.busy}
                              onClick={() => {
                                const win = window.open(
                                  "about:blank",
                                  "_blank",
                                );
                                if (win) win.opener = null;
                                void w.run(async () => {
                                  try {
                                    const { data } = await apiClient.get<{
                                      url: string;
                                    }>(
                                      base +
                                        "/projects/" +
                                        id +
                                        "/items/" +
                                        i.pit_id +
                                        "/open",
                                    );
                                    if (win) win.location.href = data.url;
                                    else location.assign(data.url);
                                  } catch (e) {
                                    win?.close();
                                    throw e;
                                  }
                                });
                              }}
                            >
                              {tp("common.open")}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() =>
                                void w.run(async () => {
                                  await navigator.clipboard.writeText(
                                    "https://drive.google.com/file/d/" +
                                      i.drive_file_id +
                                      "/view",
                                  );
                                })
                              }
                            >
                              {tp("projectDetail.copyLink")}
                            </Button>
                            {/* REQ-261019 — 작성자·담당자·테넌트 마스터 삭제(Google 원본 유지) */}
                            <DeleteItemButton projectId={id} item={i} onDeleted={refresh} />
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() =>
                              i.pit_kind === "ISSUE"
                                ? navigate(`/admin/issues/${i.pit_id}`)
                                : openDoc(i)
                            }
                          >
                            {readOnly
                              ? tp("projectDetail.viewContent")
                              : tp("projectDetail.viewEdit")}
                          </Button>
                        )}
                        {!i.drive_file_id && i.pit_kind !== "ISSUE" && (
                          <DeleteItemButton projectId={id} item={i} onDeleted={refresh} />
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
      {editing && (
        <ProjectEditor project={project} close={() => setEditing(false)} />
      )}{" "}
      {/* REQ-261015C — 이슈는 공통 이슈 폼(유형·우선순위·기간)으로 등록한다. */}
      {itemEdit && kind === "ISSUE" && (
        <IssueFormDialog
          projectId={id}
          issue={itemEdit === "new" ? undefined : (itemEdit as unknown as Issue)}
          close={() => setItemEdit(null)}
        />
      )}
      {itemEdit && kind !== "ISSUE" && (
        <ItemEditor
          project={project}
          item={itemEdit === "new" ? undefined : itemEdit}
          kind={kind === "NOTE" ? "NOTE" : "ISSUE"}
          readOnly={readOnly}
          close={() => setItemEdit(null)}
        />
      )}{" "}
      {newDoc && (
        <CreateFile
          project={id}
          documents={kind === "DOCUMENT"}
          initialKind={docType === "SHEET" ? "SHEET" : "DOCUMENT"}
          close={() => setNewDoc(false)}
        />
      )}{" "}
      {driveModal && (
        <DriveBrowser
          project={id}
          readOnly={readOnly}
          close={() => setDriveModal(false)}
        />
      )}
    </section>
  );
}
function ItemEditor({
  project,
  item,
  kind,
  readOnly,
  close,
}: {
  project: Project;
  item?: Item;
  kind: "ISSUE" | "NOTE";
  readOnly: boolean;
  close: () => void;
}) {
  const qc = useQueryClient(),
    w = useWork();
  const { t: tp } = useTranslation("prj");
  const [title, setTitle] = useState(item?.pit_title ?? ""),
    [body, setBody] = useState(item?.pit_body ?? ""),
    [status, setStatus] = useState(item?.pit_status ?? "OPEN"),
    [assignee, setAssignee] = useState(item?.assignee_id ?? ""),
    [due, setDue] = useState(item?.due_date?.slice(0, 10) ?? "");
  const dirty =
    title !== (item?.pit_title ?? "") ||
    body !== (item?.pit_body ?? "") ||
    status !== (item?.pit_status ?? "OPEN") ||
    assignee !== (item?.assignee_id ?? "") ||
    due !== (item?.due_date?.slice(0, 10) ?? "");
  function dismiss() {
    if (
      !w.busy &&
      (!dirty ||
        readOnly ||
        window.confirm(tp("itemEditor.confirmDiscard")))
    )
      close();
  }
  return (
    <Dialog open onOpenChange={(v) => !v && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {tp(
              `itemEditor.${kind === "NOTE" ? "note" : "issue"}${item ? "Detail" : "Create"}`,
            )}
          </DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void w.run(async () => {
              const d = {
                kind,
                title,
                body,
                status,
                assigneeId: assignee || null,
                dueDate: due || null,
              };
              const url = base + "/projects/" + project.prj_id + "/items";
              if (item) await apiClient.put(url + "/" + item.pit_id, d);
              else await apiClient.post(url, d);
              await qc.invalidateQueries({ queryKey: ["prj"] });
              close();
            });
          }}
        >
          <Field title={tp("itemEditor.title")}>
            <Input
              required
              maxLength={200}
              disabled={readOnly}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field title={tp("itemEditor.body")}>
            <textarea
              rows={8}
              maxLength={50000}
              className={input}
              disabled={readOnly}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          {kind === "ISSUE" && (
            <>
              <Field title={tp("itemEditor.status")}>
                <select
                  className={input}
                  disabled={readOnly}
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as Item["pit_status"])
                  }
                >
                  {["OPEN", "IN_PROGRESS", "DONE"].map((s) => (
                    <option key={s} value={s}>
                      {statusName(s)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field title={tp("itemEditor.assignee")}>
                <select
                  className={input}
                  disabled={readOnly}
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">{tp("common.unassigned")}</option>
                  {project.members?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field title={tp("itemEditor.due")}>
                <Input
                  type="date"
                  disabled={readOnly}
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </Field>
            </>
          )}
          <Notice text={w.error} />
          {!readOnly && (
            <Button type="submit" disabled={w.busy}>
              {tp("common.save")}
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function CreateFile({
  initialKind = "DOCUMENT",
  project,
  documents,
  close,
  parent,
}: {
  initialKind?: string;
  project: string;
  documents: boolean;
  close: () => void;
  parent?: string;
}) {
  const qc = useQueryClient(),
    w = useWork();
  const { t: tp } = useTranslation("prj");
  const [title, setTitle] = useState(""),
    [kind, setKind] = useState(documents ? initialKind : "UPLOAD"),
    [file, setFile] = useState<File | null>(null),
    [progress, setProgress] = useState(0),
    [attempted, setAttempted] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && !w.busy && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {documents
              ? tp("createFile.titleDocs")
              : tp("createFile.titleFiles")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void w.run(async () => {
              const url = base + "/projects/" + project + "/drive";
              const fingerprint = Array.from(
                new Uint8Array(
                  await crypto.subtle.digest(
                    "SHA-256",
                    new TextEncoder().encode(
                      JSON.stringify([
                        project,
                        title,
                        kind,
                        parent,
                        file?.name,
                        file?.size,
                        file?.lastModified,
                      ]),
                    ),
                  ),
                ),
              )
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
              const operationKey = "acm-prj-operation:" + fingerprint;
              const operation =
                sessionStorage.getItem(operationKey) ?? crypto.randomUUID();

              if (kind === "UPLOAD") {
                if (!file) throw new Error(tp("createFile.selectFile"));
                if (file.size > 50 * 1024 * 1024)
                  throw new Error(tp("createFile.maxSize50"));
                sessionStorage.setItem(operationKey, operation);
                setAttempted(true);
                const form = new FormData();
                form.append("file", file);
                form.append("title", title || file.name);
                form.append("kind", "DOCUMENT");
                form.append("operationId", operation);
                if (parent) form.append("parentId", parent);
                await apiClient.post(url + "/upload", form, {
                  timeout: 90000,
                  onUploadProgress: (e) =>
                    setProgress(
                      Math.round((e.loaded / (e.total ?? e.loaded)) * 100),
                    ),
                });
              } else {
                sessionStorage.setItem(operationKey, operation);
                setAttempted(true);
                await apiClient.post(
                  url + "/create",
                  { title, kind, operationId: operation, parentId: parent },
                  { timeout: 90000 },
                );
              }
              sessionStorage.removeItem(operationKey);
              await qc.invalidateQueries({ queryKey: ["prj"] });
              close();
            });
          }}
        >
          <Field title={tp("createFile.type")}>
            <select
              disabled={attempted}
              className={input}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {documents ? (
                <>
                  <option value="DOCUMENT">{tp("createFile.googleDoc")}</option>
                  <option value="SHEET">{tp("createFile.googleSheet")}</option>
                </>
              ) : (
                <>
                  <option value="UPLOAD">{tp("createFile.upload")}</option>
                  <option value="FOLDER">{tp("createFile.folder")}</option>
                </>
              )}
            </select>
          </Field>
          <Field title={tp("createFile.name")}>
            <Input
              required
              maxLength={200}
              disabled={attempted}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          {kind === "UPLOAD" && (
            <Field title={tp("createFile.fileMax20")}>
              <input
                type="file"
                disabled={attempted}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f) setTitle(f.name.slice(0, 200));
                }}
              />
            </Field>
          )}
          {w.busy && (
            <p>
              {kind === "UPLOAD"
                ? tp("createFile.uploading", { progress })
                : tp("createFile.creatingInGoogle")}
            </p>
          )}
          <Notice text={w.error} />
          <Button type="submit" disabled={w.busy}>
            {attempted ? tp("createFile.retry") : tp("createFile.create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function DriveBrowser({
  project,
  readOnly,
  close,
}: {
  project: string;
  readOnly: boolean;
  close: () => void;
}) {
  const qc = useQueryClient(),
    w = useWork();
  const { t: tp } = useTranslation("prj");
  const [path, setPath] = useState<{ id: string; name: string }[]>([]),
    [page, setPage] = useState<string>(),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("name"),
    [cards, setCards] = useState(false),
    [create, setCreate] = useState(false);
  const parent = path.at(-1)?.id;
  const q = useQuery({
    queryKey: ["prj", project, "browse", parent, page, ...useScope()],
    queryFn: async () =>
      (
        await apiClient.get<{ files: DriveFile[]; nextPageToken?: string }>(
          base + "/projects/" + project + "/drive",
          { params: { parent, page } },
        )
      ).data,
  });
  const rows = [...(q.data?.files ?? [])]
    .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "size"
        ? Number(b.size ?? 0) - Number(a.size ?? 0)
        : sort === "type"
          ? a.mimeType.localeCompare(b.mimeType)
          : a.name.localeCompare(b.name),
    );
  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{tp("driveBrowser.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setPath([]);
              setPage(undefined);
            }}
          >
            {tp("driveBrowser.allFolders")}
          </Button>
          {path.map((p, i) => (
            <Button
              variant="outline"
              key={p.id}
              onClick={() => {
                setPath(path.slice(0, i + 1));
                setPage(undefined);
              }}
            >
              {p.name}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label={tp("driveBrowser.search")}
            placeholder={tp("driveBrowser.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label={tp("common.sort")}
            className={input}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">{tp("driveBrowser.sortName")}</option>
            <option value="size">{tp("driveBrowser.sortSize")}</option>
            <option value="type">{tp("driveBrowser.sortType")}</option>
          </select>
          <Button variant="outline" onClick={() => setCards(!cards)}>
            {cards ? tp("driveBrowser.listView") : tp("driveBrowser.cardView")}
          </Button>
          {!readOnly && (
            <Button onClick={() => setCreate(true)}>
              {tp("driveBrowser.newFolderUpload")}
            </Button>
          )}
        </div>
        <Notice text={w.error || (q.error ? errorText(q.error) : "")} />
        <div className={cards ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
          {rows.map((f) => (
            <div
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded border p-3"
              key={f.id}
            >
              <span className="min-w-0 break-all">
                {f.mimeType.endsWith(".folder") ? "📁 " : ""}
                {f.name}
              </span>
              {f.mimeType.endsWith(".folder") ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setPath([...path, { id: f.id, name: f.name }]);
                    setPage(undefined);
                  }}
                >
                  {tp("driveBrowser.openFolder")}
                </Button>
              ) : (
                <Button
                  disabled={readOnly || w.busy}
                  onClick={() =>
                    void w.run(async () => {
                      await apiClient.post(
                        base + "/projects/" + project + "/drive/link",
                        { fileId: f.id },
                      );
                      await qc.invalidateQueries({ queryKey: ["prj"] });
                      close();
                    })
                  }
                >
                  {tp("driveBrowser.linkToProject")}
                </Button>
              )}
            </div>
          ))}
        </div>
        {!rows.length && !q.isLoading && <p>{tp("driveBrowser.empty")}</p>}
        {q.data?.nextPageToken && (
          <Button onClick={() => setPage(q.data?.nextPageToken)}>
            {tp("driveBrowser.nextPage")}
          </Button>
        )}
        {page && (
          <Button variant="outline" onClick={() => setPage(undefined)}>
            {tp("driveBrowser.firstPage")}
          </Button>
        )}
        {create && (
          <CreateFile
            project={project}
            documents={false}
            parent={parent}
            close={() => setCreate(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
