import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { clsx } from "clsx";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { errorText, useScope } from "../project-page";
import { IssueFormDialog } from "./issue-form-dialog";
import { StatusBadge } from "./issues-page";
import {
  day,
  issueBase,
  PRIORITY_BADGE,
  TRANSITIONS,
  useIssue,
  type IssueComment,
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
          </dl>
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
            <p className="min-h-16 whitespace-pre-wrap break-words text-sm">
              {i.pit_body || <span className="text-secondary">{t("issues.noDescription")}</span>}
            </p>
          ) : (
            <StatusHistory id={id} />
          )}
          <Comments id={id} readOnly={archived} canModerate={i.can_manage} />
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
        </aside>
      </div>
      {editing && <IssueFormDialog issue={i} close={() => setEditing(false)} />}
    </div>
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
          <div>
            {l.from_status ? t(`issues.status.${l.from_status}`) : t("issues.created")} →{" "}
            <strong>{t(`issues.status.${l.to_status}`)}</strong>
          </div>
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
}: {
  id: string;
  readOnly: boolean;
  canModerate: boolean;
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
        <article key={c.pic_id} className="rounded border bg-surface p-3 text-sm">
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
              <textarea
                rows={3}
                maxLength={10000}
                className="w-full rounded border bg-surface p-2"
                value={edit.body}
                onChange={(e) => setEdit({ id: c.pic_id, body: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEdit(null)}>
                  {t("issues.form.cancel")}
                </Button>
                <Button
                  disabled={!edit.body.trim() || write.isPending}
                  onClick={() => write.mutate({ method: "put", id: c.pic_id, body: edit.body })}
                >
                  {t("issues.form.save")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{c.pic_body}</p>
          )}
        </article>
      ))}
      {!readOnly && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) write.mutate({ method: "post", body: draft });
          }}
        >
          <textarea
            rows={3}
            maxLength={10000}
            placeholder={t("issues.commentPlaceholder")}
            aria-label={t("issues.commentPlaceholder")}
            className="w-full rounded border bg-surface p-2 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex justify-end">
            <Button disabled={!draft.trim() || write.isPending}>{t("issues.addComment")}</Button>
          </div>
        </form>
      )}
      {write.error && <p role="alert" className="text-red-600">{errorText(write.error)}</p>}
    </section>
  );
}
