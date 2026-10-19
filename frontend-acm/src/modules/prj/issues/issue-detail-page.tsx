import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Link as LinkIcon } from "lucide-react";
import { clsx } from "clsx";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { errorText, useScope } from "../project-page";
import { IssueFormDialog } from "./issue-form-dialog";
import { IssueRichEditor, IssueRichView, isBlankHtml, type MentionCandidate } from "./issue-rich-text";
import { StatusBadge } from "./issues-page";
import {
  day,
  issueBase,
  PRIORITY_BADGE,
  refLabel,
  sourceRef,
  TRANSITIONS,
  useIssue,
  type IssueAttachment,
  type IssueComment,
  type IssueDetail,
  type IssueStatus,
  type IssueStatusLog,
} from "./issue-model";

/** REQ-261015C — /admin/issues/:id 이슈 상세. */
export function IssueDetailPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const issue = useIssue(id);
  const [tab, setTab] = useState<"description" | "history">("description");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const status = useMutation({
    mutationFn: async (next: IssueStatus) =>
      apiClient.patch(`${issueBase}/issues/${id}/status`, { status: next, note }),
    onSuccess: async () => {
      setNote("");
      await qc.invalidateQueries({ queryKey: ["prj"] });
    },
  });
  const remove = useMutation({
    mutationFn: async () => apiClient.delete(`${issueBase}/issues/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["prj"] });
      navigate("/admin/issues");
    },
  });
  if (issue.isLoading) return <p>{t("issues.loading")}</p>;
  if (!issue.data)
    return (
      <p role="alert">{issue.error ? errorText(issue.error) : t("issues.notFound")}</p>
    );
  const i = issue.data;
  const archived = i.prj_status === "ARCHIVED";
  const canDelete = !archived && (i.created_by === user?.id || i.can_manage);
  return (
    <div className="grid min-w-0 gap-4">
      <Link
        to="/admin/issues"
        className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
      >
        <ArrowLeft size={16} />
        {t("issues.backToList")}
      </Link>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid min-w-0 content-start gap-4">
          <header className="flex flex-wrap items-start gap-2">
            <h1 className="min-w-0 flex-1 break-words text-xl font-semibold text-primary">
              {i.pit_ref_no && (
                <span className="mr-2 font-mono text-base font-normal text-gray-400">{refLabel(i.pit_ref_no)}</span>
              )}
              {i.pit_title}
            </h1>
            {!archived && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                {t("issues.edit")}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(t("issues.deleteConfirm"))) remove.mutate();
                }}
              >
                {t("issues.delete")}
              </Button>
            )}
          </header>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border bg-surface p-4 text-sm sm:grid-cols-3">
            <Meta label={t("issues.fields.type")}>{t(`issues.type.${i.pit_issue_type}`)}</Meta>
            <Meta label={t("issues.fields.priority")}>
              <span className={PRIORITY_BADGE[i.pit_priority]}>{t(`issues.priority.${i.pit_priority}`)}</span>
            </Meta>
            <Meta label={t("issues.fields.project")}>
              <Link className="hover:underline" to={`/admin/projects/${i.prj_id}?tab=issues`}>
                {i.prj_title}
              </Link>
            </Meta>
            <Meta label={t("issues.fields.reporter")}>{i.creator_name ?? "—"}</Meta>
            <Meta label={t("issues.fields.assignee")}>{i.assignee_name ?? t("issues.unassigned")}</Meta>
            <Meta label={t("issues.fields.period")}>
              {day(i.start_date) || "—"} ~ {day(i.due_date) || "—"}
            </Meta>
            <Meta label={t("issues.fields.createdAt")}>{new Date(i.created_at).toLocaleString()}</Meta>
            <Meta label={t("issues.fields.updatedAt")}>{new Date(i.updated_at).toLocaleString()}</Meta>
            {i.pit_done_at && (
              <Meta label={t("issues.fields.doneAt")}>{new Date(i.pit_done_at).toLocaleString()}</Meta>
            )}
            <Meta label={t("issues.fields.doneRatio")}>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                  <span className="block h-full rounded-full bg-green-500" style={{ width: `${i.pit_done_ratio}%` }} />
                </span>
                <span className="font-mono">{i.pit_done_ratio}%</span>
              </span>
            </Meta>
            {i.pit_parent_id && (
              <Meta label={t("issues.fields.parentIssue")}>
                <Link className="text-indigo-600 hover:underline" to={`/admin/issues/${i.pit_parent_id}`}>
                  {refLabel(i.parent_ref_no)} {i.parent_title}
                </Link>
              </Meta>
            )}
            {i.participant_ids.length > 0 && (
              <Meta label={t("issues.fields.participants")}>
                {i.participant_ids.map((p) => i.members.find((m) => m.id === p)?.name ?? "—").join(", ")}
              </Meta>
            )}
            {i.pit_source && (
              <Meta label={t("issues.fields.source")}>{t("issues.migratedFrom", { ref: sourceRef(i) })}</Meta>
            )}
          </dl>
          {i.attachments.length > 0 && <Attachments prj={i.prj_id} items={i.attachments} />}
          {i.pit_resolution && (
            <section className="rounded-lg border bg-surface p-4 text-sm">
              <h2 className="mb-1 text-xs text-secondary">{t("issues.fields.resolution")}</h2>
              <p className="whitespace-pre-wrap break-words">{i.pit_resolution}</p>
            </section>
          )}
          <div className="flex gap-1 border-b" role="tablist">
            {(["description", "history"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={clsx(
                  "-mb-px border-b-2 px-4 py-2 text-sm",
                  tab === k ? "border-accent-600 text-accent-700" : "border-transparent text-secondary",
                )}
              >
                {t(`issues.tabs.${k}`)}
              </button>
            ))}
          </div>
          {tab === "description" ? (
            <div className="min-h-16 break-words">
              {isBlankHtml(i.pit_body) ? (
                <p className="text-sm text-secondary">{t("issues.noDescription")}</p>
              ) : (
                <IssueRichView html={i.pit_body} />
              )}
            </div>
          ) : (
            <StatusHistory id={id} />
          )}
          <Comments id={id} readOnly={archived} canModerate={i.can_manage} members={i.members} />
        </div>
        <aside className="grid content-start gap-3 rounded-lg border bg-surface p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-secondary">{t("issues.fields.status")}</span>
            <StatusBadge status={i.pit_status} />
          </div>
          {!archived && (
            <>
              <div className="flex flex-wrap gap-2">
                {TRANSITIONS[i.pit_status].map((s) => (
                  <Button
                    key={s}
                    variant={s === "DONE" ? "default" : "outline"}
                    disabled={status.isPending}
                    onClick={() => status.mutate(s)}
                  >
                    {t(`issues.transition.${s}`)}
                  </Button>
                ))}
              </div>
              <label className="grid gap-1">
                <span className="text-xs text-secondary">{t("issues.statusNote")}</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  className="w-full rounded border bg-surface p-2"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </>
          )}
          {status.error && <p role="alert" className="text-red-600">{errorText(status.error)}</p>}
          {remove.error && <p role="alert" className="text-red-600">{errorText(remove.error)}</p>}
          <AssigneePanel issue={i} readOnly={archived} />
        </aside>
      </div>
      {editing && <IssueFormDialog issue={i} close={() => setEditing(false)} />}
    </div>
  );
}

/**
 * REQ-261016D — 담당자 지정: 검색 대신 참여자 목록에서 먼저 선택하고 [지정]으로 변경한다.
 */
function AssigneePanel({ issue, readOnly }: { issue: IssueDetail; readOnly: boolean }) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: async (assigneeId: string | null) =>
      apiClient.patch(`${issueBase}/issues/${issue.pit_id}/assignee`, { assigneeId }),
    onSuccess: async () => {
      setPicked(null);
      await qc.invalidateQueries({ queryKey: ["prj"] });
    },
  });
  const current = issue.members.find((m) => m.id === issue.assignee_id);
  const target = issue.members.find((m) => m.id === picked);
  return (
    <section className="grid gap-2 border-t pt-3" aria-label={t("issues.assign.title")}>
      <div className="flex items-center justify-between">
        <span className="text-secondary">{t("issues.assign.title")}</span>
        <span className="font-medium">{current?.name ?? issue.assignee_name ?? t("issues.assign.none")}</span>
      </div>
      {!readOnly && (
        <>
          <p className="text-xs text-secondary">{t("issues.assign.pick")}</p>
          <ul className="grid max-h-60 gap-1 overflow-y-auto" role="radiogroup">
            {issue.members.map((m) => {
              const isCurrent = m.id === issue.assignee_id;
              const on = picked === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={isCurrent || change.isPending}
                    onClick={() => setPicked(m.id)}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left",
                      on ? "border-indigo-500 bg-indigo-50" : "border-transparent hover:bg-[var(--gray-50)]",
                      isCurrent && "cursor-default opacity-70",
                    )}
                  >
                    <span
                      className={clsx(
                        "h-3.5 w-3.5 shrink-0 rounded-full border",
                        on ? "border-indigo-600 bg-accent-600 ring-2 ring-inset ring-white" : "border-gray-300",
                      )}
                    />
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                      {m.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{m.name}</span>
                      {m.email && <span className="block truncate text-xs text-secondary">{m.email}</span>}
                    </span>
                    {isCurrent && (
                      <span className="shrink-0 rounded-full bg-accent-600 px-1.5 text-[10.5px] font-semibold text-white">
                        {t("issues.assign.currentTag")}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            {issue.assignee_id && (
              <Button
                variant="outline"
                disabled={change.isPending}
                onClick={() => {
                  if (window.confirm(t("issues.assign.confirmUnassign"))) change.mutate(null);
                }}
              >
                {t("issues.assign.unassign")}
              </Button>
            )}
            <Button
              disabled={!target || change.isPending}
              onClick={() => {
                if (target && window.confirm(t("issues.assign.confirm", { name: target.name }))) change.mutate(target.id);
              }}
            >
              {t("issues.assign.assign")}
            </Button>
          </div>
        </>
      )}
      {change.error && <p role="alert" className="text-red-600">{errorText(change.error)}</p>}
    </section>
  );
}

/** REQ-261016C — 첨부: 프로젝트 파일은 다운로드 경로(ACM 저장소 서명 URL·Drive)로, URL 은 새 창. */
function Attachments({ prj, items }: { prj: string; items: IssueAttachment[] }) {
  const { t } = useTranslation("common");
  const [error, setError] = useState("");
  const open = async (a: IssueAttachment) => {
    setError("");
    if (a.pia_url) {
      window.open(a.pia_url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const { url } = (await apiClient.get<{ url: string }>(`${issueBase}/projects/${prj}/files/${a.file_item_id}/download`)).data;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <section className="rounded-lg border bg-surface p-4 text-sm">
      <h2 className="mb-2 text-xs text-secondary">{t("issues.fields.attachments")}</h2>
      <ul className="space-y-1">
        {items.map((a) => (
          <li key={a.pia_id}>
            <button
              type="button"
              disabled={!a.pia_url && !a.file_available}
              onClick={() => void open(a)}
              className="inline-flex max-w-full items-center gap-2 text-indigo-600 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              {a.pia_url ? <LinkIcon className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
              <span className="truncate">{a.pia_name}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-1 text-red-600">{error}</p>}
    </section>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  );
}

function StatusHistory({ id }: { id: string }) {
  const { t } = useTranslation("common");
  const scope = useScope();
  const logs = useQuery({
    queryKey: ["prj", "issue", id, "logs", ...scope],
    queryFn: async () =>
      (await apiClient.get<IssueStatusLog[]>(`${issueBase}/issues/${id}/status-logs`)).data,
  });
  if (logs.isLoading) return <p>{t("issues.loading")}</p>;
  return (
    <ol className="grid gap-2 text-sm">
      {logs.data?.map((l) => (
        <li key={l.psl_id} className="rounded border bg-surface px-3 py-2">
          <span className="text-secondary">{new Date(l.created_at).toLocaleString()} · {l.changed_by_name ?? "—"}</span>
          {l.psl_kind === "ASSIGNEE" ? (
            <div>
              {t("issues.historyAssignee", {
                from: l.from_user_name ?? t("issues.unassigned"),
                to: l.to_user_name ?? t("issues.unassigned"),
              })}
            </div>
          ) : (
            <div>
              {l.from_status ? t(`issues.status.${l.from_status}`) : t("issues.created")} →{" "}
              <strong>{t(`issues.status.${l.to_status}`)}</strong>
            </div>
          )}
          {l.psl_note && <p className="whitespace-pre-wrap text-secondary">{l.psl_note}</p>}
        </li>
      ))}
    </ol>
  );
}

function Comments({
  id,
  readOnly,
  canModerate,
  members,
}: {
  id: string;
  readOnly: boolean;
  canModerate: boolean;
  /** REQ-261016E — 멘션 후보 */
  members: MentionCandidate[];
}) {
  const { t } = useTranslation("common");
  const scope = useScope();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const key = ["prj", "issue", id, "comments", ...scope];
  const url = `${issueBase}/issues/${id}/comments`;
  const comments = useQuery({
    queryKey: key,
    queryFn: async () => (await apiClient.get<IssueComment[]>(url)).data,
  });
  const [draft, setDraft] = useState("");
  // REQ-261016E — 멘션 알림(#comment-…)으로 들어오면 해당 댓글로 이동
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash.startsWith("#comment-") || !comments.data) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hash, comments.data]);
  const [edit, setEdit] = useState<{ id: string; body: string } | null>(null);
  const write = useMutation({
    mutationFn: async (a: { method: "post" | "put" | "delete"; id?: string; body?: string }) =>
      (
        a.method === "post"
          ? await apiClient.post<IssueComment[]>(url, { body: a.body })
          : a.method === "put"
            ? await apiClient.put<IssueComment[]>(`${url}/${a.id}`, { body: a.body })
            : await apiClient.delete<IssueComment[]>(`${url}/${a.id}`)
      ).data,
    onSuccess: (data, a) => {
      qc.setQueryData(key, data);
      if (a.method === "post") setDraft("");
      setEdit(null);
    },
  });
  return (
    <section className="grid gap-3" aria-label={t("issues.comments")}>
      <h2 className="font-semibold">
        {t("issues.comments")} ({comments.data?.length ?? 0})
      </h2>
      {comments.data?.map((c) => (
        <article
          key={c.pic_id}
          id={`comment-${c.pic_id}`}
          className={clsx(
            "scroll-mt-20 rounded border bg-surface p-3 text-sm",
            hash === `#comment-${c.pic_id}` && "border-indigo-400 ring-2 ring-indigo-200",
          )}
        >
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-secondary">
            <span className="font-medium text-primary">{c.author_name ?? "—"}</span>
            <span>{new Date(c.created_at).toLocaleString()}</span>
            {c.updated_at !== c.created_at && <span>({t("issues.edited")})</span>}
            {!readOnly && c.author_id === user?.id && (
              <button type="button" className="ml-auto hover:underline" onClick={() => setEdit({ id: c.pic_id, body: c.pic_body })}>
                {t("issues.edit")}
              </button>
            )}
            {!readOnly && (c.author_id === user?.id || canModerate) && (
              <button
                type="button"
                className={clsx("hover:underline", c.author_id !== user?.id && "ml-auto")}
                onClick={() => {
                  if (window.confirm(t("issues.deleteCommentConfirm")))
                    write.mutate({ method: "delete", id: c.pic_id });
                }}
              >
                {t("issues.delete")}
              </button>
            )}
          </div>
          {edit?.id === c.pic_id ? (
            <div className="grid gap-2">
              <IssueRichEditor
                compact
                mentionCandidates={members}
                value={edit.body}
                onChange={(v) => setEdit({ id: c.pic_id, body: v })}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEdit(null)}>
                  {t("issues.form.cancel")}
                </Button>
                <Button
                  disabled={isBlankHtml(edit.body) || write.isPending}
                  onClick={() => write.mutate({ method: "put", id: c.pic_id, body: edit.body })}
                >
                  {t("issues.form.save")}
                </Button>
              </div>
            </div>
          ) : (
            <IssueRichView html={c.pic_body} />
          )}
        </article>
      ))}
      {!readOnly && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isBlankHtml(draft)) write.mutate({ method: "post", body: draft });
          }}
        >
          <IssueRichEditor
            compact
            mentionCandidates={members}
            value={draft}
            onChange={setDraft}
            placeholder={t("issues.commentPlaceholder")}
          />
          <div className="flex justify-end">
            <Button disabled={isBlankHtml(draft) || write.isPending}>{t("issues.addComment")}</Button>
          </div>
        </form>
      )}
      {write.error && <p role="alert" className="text-red-600">{errorText(write.error)}</p>}
    </section>
  );
}
