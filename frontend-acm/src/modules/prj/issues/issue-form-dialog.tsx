import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText, useScope } from "../project-page";
import type { Project } from "../types";
import {
  day,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  issueBase,
  PRIORITIES,
  TRANSITIONS,
  type Issue,
  type IssueStatus,
} from "./issue-model";

const field = "w-full min-w-0 rounded border bg-surface p-2 text-sm";

/**
 * REQ-261015C — 이슈 등록/수정. 프로젝트를 지정하면 고정, 아니면 접근 가능한 프로젝트 중 선택.
 */
export function IssueFormDialog({
  issue,
  projectId,
  close,
  onSaved,
}: {
  issue?: Issue;
  projectId?: string;
  close: () => void;
  onSaved?: (id: string) => void;
}) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const scope = useScope();
  const projects = useQuery({
    queryKey: ["prj", ...scope],
    queryFn: async () =>
      (await apiClient.get<Project[]>(`${issueBase}/projects`)).data,
  });
  const [prj, setPrj] = useState(issue?.prj_id ?? projectId ?? "");
  const detail = useQuery({
    enabled: !!prj,
    queryKey: ["prj", prj, ...scope],
    queryFn: async () =>
      (await apiClient.get<Project>(`${issueBase}/projects/${prj}`)).data,
  });
  const [form, setForm] = useState({
    title: issue?.pit_title ?? "",
    body: issue?.pit_body ?? "",
    issueType: issue?.pit_issue_type ?? "TASK",
    priority: issue?.pit_priority ?? 3,
    status: (issue?.pit_status ?? "OPEN") as IssueStatus,
    assigneeId: issue?.assignee_id ?? "",
    startDate: day(issue?.start_date),
    dueDate: day(issue?.due_date),
  });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };
  const statusOptions = issue
    ? [issue.pit_status, ...TRANSITIONS[issue.pit_status]]
    : ISSUE_STATUSES.filter((s) => s !== "REJECTED");
  const dismiss = () => {
    if (!busy && (!dirty || window.confirm(t("issues.form.discard")))) close();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && dismiss()}>
      <DialogContent className="max-h-[94dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {issue ? t("issues.form.editTitle") : t("issues.form.createTitle")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!prj) return;
            setBusy(true);
            setError("");
            void (async () => {
              try {
                const body = {
                  kind: "ISSUE",
                  title: form.title,
                  body: form.body,
                  status: form.status,
                  issueType: form.issueType,
                  priority: Number(form.priority),
                  assigneeId: form.assigneeId || null,
                  startDate: form.startDate || null,
                  dueDate: form.dueDate || null,
                };
                const url = `${issueBase}/projects/${prj}/items`;
                const saved = issue
                  ? (await apiClient.put<{ pit_id: string }>(`${url}/${issue.pit_id}`, body)).data
                  : (await apiClient.post<{ pit_id: string }>(url, body)).data;
                await qc.invalidateQueries({ queryKey: ["prj"] });
                setDirty(false);
                onSaved?.(saved.pit_id);
                close();
              } catch (err) {
                setError(errorText(err));
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <label className="grid gap-1">
            {t("issues.fields.project")}
            <select
              required
              className={field}
              value={prj}
              disabled={!!issue || !!projectId}
              onChange={(e) => {
                setPrj(e.target.value);
                set("assigneeId", "");
              }}
            >
              <option value="">{t("issues.form.pickProject")}</option>
              {projects.data
                ?.filter((p) => p.prj_status !== "ARCHIVED" || p.prj_id === prj)
                .map((p) => (
                  <option key={p.prj_id} value={p.prj_id}>
                    {p.prj_title}
                  </option>
                ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1">
              {t("issues.fields.type")}
              <select
                className={field}
                value={form.issueType}
                onChange={(e) => set("issueType", e.target.value as typeof form.issueType)}
              >
                {ISSUE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(`issues.type.${v}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              {t("issues.fields.priority")}
              <select
                className={field}
                value={form.priority}
                onChange={(e) => set("priority", Number(e.target.value))}
              >
                {PRIORITIES.map((v) => (
                  <option key={v} value={v}>
                    {t(`issues.priority.${v}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              {t("issues.fields.status")}
              <select
                className={field}
                value={form.status}
                onChange={(e) => set("status", e.target.value as IssueStatus)}
              >
                {statusOptions.map((v) => (
                  <option key={v} value={v}>
                    {t(`issues.status.${v}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1">
            {t("issues.fields.title")}
            <Input
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            {t("issues.fields.description")}
            <textarea
              rows={6}
              maxLength={50000}
              className={field}
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1">
              {t("issues.fields.assignee")}
              <select
                className={field}
                value={form.assigneeId}
                disabled={!prj}
                onChange={(e) => set("assigneeId", e.target.value)}
              >
                <option value="">{t("issues.unassigned")}</option>
                {detail.data?.members?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              {t("issues.fields.startDate")}
              <Input
                type="date"
                value={form.startDate}
                max={form.dueDate || undefined}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              {t("issues.fields.dueDate")}
              <Input
                type="date"
                value={form.dueDate}
                min={form.startDate || undefined}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={dismiss}>
              {t("issues.form.cancel")}
            </Button>
            <Button disabled={busy || !prj || !form.title.trim()}>
              {busy ? t("issues.form.saving") : t("issues.form.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
