import { DocumentTable } from "./document-table";
import { DocumentPermissions } from "./document-permissions";
import { ProjectFiles } from "./project-files";
import { ProjectOverview } from "./project-overview";
import { projectDocumentPath } from "./document-page";
import {
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { AdminSupportSlot } from "@/components/layout/admin-content-layout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pickGoogle } from "./google-picker";
import {
  type Project,
  type Item,
  type Person,
  type DriveStatus,
  type DriveFile,
  statusNames,
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
    "요청을 완료하지 못했습니다."
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
    <section className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">프로젝트 관리</h1>
        <Button onClick={() => setEdit(true)}>+ 프로젝트 생성</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={mine ? "outline" : "default"}
          onClick={() => setMine(false)}
        >
          참여 프로젝트
        </Button>
        <Button
          variant={mine ? "default" : "outline"}
          onClick={() => setMine(true)}
        >
          담당 프로젝트
        </Button>
        <Link className="p-2 underline" to="/admin/drive">
          Google Drive 연결
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="프로젝트 검색"
          placeholder="프로젝트 검색"
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="프로젝트 상태"
          className={input + " !w-auto"}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">전체 (보관 제외)</option>
          <option value="ACTIVE">진행중</option>
          <option value="DONE">완료</option>
          <option value="ARCHIVED">보관함</option>
        </select>
        <select
          aria-label="정렬"
          className={input + " !w-auto"}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updated">최근 수정순</option>
          <option value="issues">이슈 많은 순</option>
        </select>
      </div>
      <Notice text={q.error ? errorText(q.error) : ""} />
      {q.isLoading ? (
        <p>불러오는 중…</p>
      ) : !rows.length ? (
        <p>등록된 프로젝트가 없습니다.</p>
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
                <span>{statusNames[p.prj_status]}</span>
              </div>
              <h2 className="my-3 break-words text-lg font-semibold">
                {p.prj_title}
              </h2>
              <p className="text-sm">
                참여자 {p.member_count}명 · 이슈 {p.issue_count}개
              </p>
              <ul className="mt-3 grid gap-1 text-sm">
                {p.recent_issues?.map((i, n) => (
                  <li className="truncate" key={n}>
                    {statusNames[i.pit_status]} · {i.pit_title}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-secondary">
                최근 수정 {new Date(p.updated_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
      {edit && <ProjectEditor close={() => setEdit(false)} />}
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
            {project ? "프로젝트 수정 · 참여자 관리" : "프로젝트 생성"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <Field title="프로젝트명">
            <Input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field title="설명">
            <textarea
              className={input}
              maxLength={10000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field title="담당자">
            <select
              required
              className={input}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">선택</option>
              {people.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="max-h-36 overflow-auto rounded border p-2">
            <legend>프로젝트 매니저</legend>
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
            <legend>참여자</legend>
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
            <Field title="상태">
              <select
                className={input}
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as Project["prj_status"])
                }
              >
                {["ACTIVE", "DONE", "ARCHIVED"].map((s) => (
                  <option key={s} value={s}>
                    {statusNames[s]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Notice
            text={w.error || (people.error ? errorText(people.error) : "")}
          />
          <Button disabled={w.busy || people.isLoading} type="submit">
            {w.busy ? "저장 중…" : "저장"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function DriveConnectionPage() {
  return (
    <section className="grid gap-4">
      <h1 className="text-xl font-bold">Google Drive 연결</h1>
      <DriveConnection />
      <Link to="/admin/projects" className="underline">
        프로젝트로 돌아가기
      </Link>
    </section>
  );
}
export function DriveConnection() {
  const qc = useQueryClient(),
    w = useWork();
  const [params] = useSearchParams();
  const q = useQuery({
    queryKey: ["prj-drive", ...useScope()],
    queryFn: async () =>
      (await apiClient.get<DriveStatus>(base + "/drive")).data,
  });
  const c = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["prj-drive"] });
  return (
    <div className="grid gap-3 rounded-lg border bg-surface p-4">
      <h2 className="font-semibold">학원 공용 Google Drive</h2>
      <p className="text-sm">계정 연결 → 저장 위치 선택 → 완료</p>
      <Notice
        text={
          w.error ||
          (q.error ? errorText(q.error) : "") ||
          (params.get("drive") === "failed"
            ? "Google 연결을 완료하지 못했습니다. 다시 시도하세요."
            : "")
        }
      />
      {params.get("drive") === "cancelled" && (
        <p>연결을 취소했습니다. 다시 연결할 수 있습니다.</p>
      )}
      {c && (
        <>
          <p>
            {c.connected ? `연결 계정: ${c.email}` : "연결된 계정이 없습니다."}
          </p>
          {c.connected && (
            <p>저장 위치: {c.rootName ?? "저장 위치를 선택하세요."}</p>
          )}
          {!c.configured && (
            <p>
              운영 Google OAuth 앱 설정이 필요합니다. 관리자에게 문의하세요.
            </p>
          )}
          {c.canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={w.busy || !c.configured}
                onClick={() =>
                  void w.run(async () => {
                    const { data } = await apiClient.post<{ url: string }>(
                      base + "/drive/connect",
                      { returnPath: location.pathname + location.search },
                    );
                    location.assign(data.url);
                  })
                }
              >
                {c.connected ? "다시 연결 / 계정 변경" : "Google 계정으로 연결"}
              </Button>
              {c.connected && (
                <>
                  <Button
                    variant="outline"
                    disabled={w.busy}
                    onClick={() =>
                      void w.run(async () => {
                        await apiClient.put(base + "/drive/root", {});
                        await refresh();
                      })
                    }
                  >
                    프로젝트 기본 저장 폴더 사용
                  </Button>
                  <Button
                    variant="outline"
                    disabled={w.busy}
                    onClick={() =>
                      void w.run(async () => {
                        const id = await pickGoogle(true);
                        if (id) {
                          await apiClient.put(base + "/drive/root", {
                            fileId: id,
                          });
                          await refresh();
                        }
                      })
                    }
                  >
                    기존 폴더 선택
                  </Button>
                  <Button
                    variant="outline"
                    disabled={w.busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "연결을 해제하면 문서 생성과 업로드가 중단됩니다. Google 원본과 프로젝트 기록은 보존됩니다.",
                        )
                      )
                        void w.run(async () => {
                          await apiClient.delete(base + "/drive");
                          await refresh();
                        });
                    }}
                  >
                    연결 해제
                  </Button>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm">
              계정 연결 및 저장 위치 변경은 설정 관리자가 할 수 있습니다.
            </p>
          )}
          {c.rootId && (
            <a
              className="underline"
              target="_blank"
              rel="noreferrer"
              href={
                "https://drive.google.com/drive/folders/" +
                encodeURIComponent(c.rootId)
              }
            >
              저장 폴더 열기
            </a>
          )}
          <p className="text-xs text-secondary">
            저장 위치 변경은 새 프로젝트에 적용됩니다. 계정을 변경하면 이전
            계정의 자료는 접근이 제한될 수 있습니다. Google 문서 공유 권한은
            별도로 관리됩니다.
          </p>
        </>
      )}
    </div>
  );
}
export function ProjectDetailPage() {
  const { id = "" } = useParams(),
    [params, setParams] = useSearchParams(),
    qc = useQueryClient(),
    w = useWork(),
    slot = useContext(AdminSupportSlot);
  const user = useAuthStore((s) => s.user);
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
    queryKey: ["prj-drive", ...useScope()],
    queryFn: async () =>
      (await apiClient.get<DriveStatus>(base + "/drive")).data,
  });
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
  if (p.isLoading) return <p>불러오는 중…</p>;
  if (!p.data)
    return (
      <Notice text={p.error ? errorText(p.error) : "프로젝트가 없습니다."} />
    );
  const project = p.data,
    manage = project.can_manage ?? project.owner_id === user?.id,
    readOnly = project.prj_status === "ARCHIVED";
  const info = (
    <div className="grid gap-3">
      <h2 className="font-semibold">프로젝트 정보</h2>
      <p>{statusNames[project.prj_status]}</p>
      <h3>참여자 {project.members?.length}명</h3>
      {project.members?.map((m) => (
        <p key={m.id}>
          {m.id === project.owner_id ? "👑 " : ""}
          {m.name}
        </p>
      ))}
      {manage && (
        <Button variant="outline" onClick={() => setEditing(true)}>
          참여자 관리
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
      <Link to="/admin/projects" className="underline">
        ← 프로젝트 목록
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-secondary">
            {project.prj_code ?? `PRJ-${id.slice(0, 8)}`} ·{" "}
            {statusNames[project.prj_status]}
          </p>
          <h1 className="break-words text-xl font-bold">{project.prj_title}</h1>
          <p className="whitespace-pre-wrap break-words text-sm">
            {project.prj_description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {manage && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              프로젝트 수정
            </Button>
          )}
          <Button variant="outline" onClick={() => slot?.show()}>
            프로젝트 정보
          </Button>
        </div>
      </div>
      {slot?.target ? createPortal(info, slot.target) : null}
      <nav className="flex min-w-0 gap-2 overflow-x-auto border-b pb-2">
        {[
          ["overview", "개요", ""],
          ["documents", "문서", "DOCUMENT"],
          ["issues", "이슈", "ISSUE"],
        ].map(([key, label, k]) => (
          <Button
            key={key}
            className={`shrink-0 rounded-none border-0 border-b-2 bg-transparent shadow-none ${tab === key ? "border-blue-600 text-blue-600" : "border-transparent text-secondary"}`}
            variant="outline"
            onClick={() => {
              setParams({ tab: key });
              setFilter("");
              setAssignee("");
              setSearch("");
            }}
          >
            {label}{" "}
            {k
              ? (items.data ?? []).filter((i) =>
                  key === "documents"
                    ? i.pit_kind !== "ISSUE"
                    : i.pit_kind === k,
                ).length
              : ""}
          </Button>
        ))}
      </nav>
      <Notice text={w.error || (items.error ? errorText(items.error) : "")} />
      {readOnly && (
        <p>
          보관된 프로젝트입니다. 담당자가 상태를 변경하면 수정할 수 있습니다.
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
              aria-label="문서 분류"
              className="flex min-w-0 gap-2 overflow-x-auto"
            >
              {[
                ["MEMO", "메모"],
                ["SHEET", "시트(스프레드시트)"],
                ["DOC", "문서(Docs)"],
                ["FILE", "파일"],
              ].map(([value, label]) => (
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
                  {label}
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
                  aria-label="제목 검색"
                  placeholder="제목 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {kind === "ISSUE" && (
                  <>
                    <select
                      aria-label="이슈 상태"
                      className={input + " !w-auto"}
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="">전체 상태</option>
                      {["TODO", "DOING", "DONE"].map((s) => (
                        <option key={s} value={s}>
                          {statusNames[s]}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="담당자 필터"
                      className={input + " !w-auto"}
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                    >
                      <option value="">전체 담당자</option>
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
                      + 이슈 등록
                    </Button>
                  ) : (
                    <>
                      {docType !== "FILE" && (
                        <Button
                          onClick={() => {
                            openDoc("new", "LOCAL");
                          }}
                        >
                          {docType === "SHEET"
                            ? "+ 스프레드시트 작성"
                            : docType === "DOC"
                              ? "+ ACM 문서 작성"
                              : "+ 메모 작성"}
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
                            ? "기존 구글시트 링크 등록"
                            : "기존 구글독스 링크 등록"}
                        </Button>
                      )}
                      {(docType === "FILE" ||
                        docType === "DOC" ||
                        docType === "SHEET") && (
                        <Button
                          variant="outline"
                          onClick={() => setNewDoc(true)}
                        >
                          {docType === "FILE"
                            ? "파일 업로드 / 폴더"
                            : "Google에서 새로 만들기"}
                        </Button>
                      )}
                      {docType === "FILE" && (
                        <Button
                          variant="outline"
                          onClick={() => setDriveModal(true)}
                        >
                          프로젝트 파일 탐색
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
                          Drive 파일 연결
                        </Button>
                      )}
                    </>
                  ))}
                <Button variant="outline" onClick={() => void refresh()}>
                  새로고침
                </Button>
              </div>
              {items.isLoading ? (
                <p>불러오는 중…</p>
              ) : !rows.length ? (
                <p>등록된 항목이 없습니다.</p>
              ) : kind !== "ISSUE" ? (
                <DocumentTable
                  items={rows}
                  project={project}
                  manage={manage}
                  onEdit={openDoc}
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
                            ? `· ${statusNames[i.pit_status]} · ${project.members?.find((m) => m.id === i.assignee_id)?.name ?? "미배정"} · ${i.due_date ?? "기한 없음"}`
                            : i.drive_mime?.includes("spreadsheet")
                              ? "· Google 시트"
                              : i.drive_mime?.includes("document")
                                ? "· Google 문서"
                                : ""}
                        </p>
                        {i.pit_body && (
                          <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm">
                            {i.pit_body}
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
                              열기
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
                              링크 복사
                            </Button>
                            {!readOnly && (
                              <Button
                                variant="outline"
                                disabled={w.busy}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "ACM 연결을 해제합니다. Google 원본 파일은 삭제되지 않습니다.",
                                    )
                                  )
                                    void w.run(async () => {
                                      await apiClient.delete(
                                        base +
                                          "/projects/" +
                                          id +
                                          "/items/" +
                                          i.pit_id +
                                          "/link",
                                      );
                                      await refresh();
                                    });
                                }}
                              >
                                연결 해제
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() =>
                              i.pit_kind === "ISSUE"
                                ? setItemEdit(i)
                                : openDoc(i)
                            }
                          >
                            {readOnly ? "내용 보기" : "보기 / 수정"}
                          </Button>
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
      {itemEdit && (
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
  const [title, setTitle] = useState(item?.pit_title ?? ""),
    [body, setBody] = useState(item?.pit_body ?? ""),
    [status, setStatus] = useState(item?.pit_status ?? "TODO"),
    [assignee, setAssignee] = useState(item?.assignee_id ?? ""),
    [due, setDue] = useState(item?.due_date?.slice(0, 10) ?? "");
  const dirty =
    title !== (item?.pit_title ?? "") ||
    body !== (item?.pit_body ?? "") ||
    status !== (item?.pit_status ?? "TODO") ||
    assignee !== (item?.assignee_id ?? "") ||
    due !== (item?.due_date?.slice(0, 10) ?? "");
  function dismiss() {
    if (
      !w.busy &&
      (!dirty ||
        readOnly ||
        window.confirm("저장하지 않은 변경을 닫으시겠습니까?"))
    )
      close();
  }
  return (
    <Dialog open onOpenChange={(v) => !v && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {kind === "NOTE" ? "노트" : "이슈"} {item ? "상세" : "등록"}
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
          <Field title="제목">
            <Input
              required
              maxLength={200}
              disabled={readOnly}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field title="내용">
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
              <Field title="상태">
                <select
                  className={input}
                  disabled={readOnly}
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as Item["pit_status"])
                  }
                >
                  {["TODO", "DOING", "DONE"].map((s) => (
                    <option key={s} value={s}>
                      {statusNames[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field title="담당자">
                <select
                  className={input}
                  disabled={readOnly}
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">미배정</option>
                  {project.members?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field title="기한">
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
              저장
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
            {documents ? "문서 만들기" : "파일 업로드 / 새 폴더"}
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
                if (!file) throw new Error("파일을 선택하세요.");
                if (file.size > 20 * 1024 * 1024)
                  throw new Error("20MB 이하 파일을 선택하세요.");
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
          <Field title="유형">
            <select
              disabled={attempted}
              className={input}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {documents ? (
                <>
                  <option value="DOCUMENT">Google 문서</option>
                  <option value="SHEET">Google 스프레드시트</option>
                </>
              ) : (
                <>
                  <option value="UPLOAD">파일 업로드</option>
                  <option value="FOLDER">새 폴더</option>
                </>
              )}
            </select>
          </Field>
          <Field title="이름">
            <Input
              required
              maxLength={200}
              disabled={attempted}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          {kind === "UPLOAD" && (
            <Field title="파일 (최대 20MB)">
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
                ? `업로드 ${progress}% · 저장 확인 중…`
                : "Google에 생성 중…"}
            </p>
          )}
          <Notice text={w.error} />
          <Button type="submit" disabled={w.busy}>
            {attempted ? "결과 확인 / 재시도" : "생성"}
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
          <DialogTitle>프로젝트 Drive 파일</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setPath([]);
              setPage(undefined);
            }}
          >
            전체 폴더
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
            aria-label="현재 페이지 파일 검색"
            placeholder="현재 페이지 파일 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="정렬"
            className={input}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">이름순</option>
            <option value="size">파일크기순</option>
            <option value="type">종류별</option>
          </select>
          <Button variant="outline" onClick={() => setCards(!cards)}>
            {cards ? "목록 보기" : "카드 보기"}
          </Button>
          {!readOnly && (
            <Button onClick={() => setCreate(true)}>새 폴더 / 업로드</Button>
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
                  폴더 열기
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
                  프로젝트에 연결
                </Button>
              )}
            </div>
          ))}
        </div>
        {!rows.length && !q.isLoading && <p>이 폴더에 파일이 없습니다.</p>}
        {q.data?.nextPageToken && (
          <Button onClick={() => setPage(q.data?.nextPageToken)}>
            다음 페이지
          </Button>
        )}
        {page && (
          <Button variant="outline" onClick={() => setPage(undefined)}>
            첫 페이지
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
