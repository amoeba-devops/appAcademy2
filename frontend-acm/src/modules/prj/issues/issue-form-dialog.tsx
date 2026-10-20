import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, FileText, Link as LinkIcon, Loader2, RotateCcw, Search, Trash2, Upload, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { errorText, useScope } from "../project-page";
import type { Project } from "../types";
import { IssueRichEditor, isBlankHtml } from "./issue-rich-text";
import {
  day,
  ISSUE_TYPES,
  issueBase,
  PRIORITIES,
  refLabel,
  TYPE_CHIP,
  type Issue,
  type IssueAttachment,
  type IssueDetail,
  type IssueType,
} from "./issue-model";

const input =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none";
const label = "mb-1 block text-sm font-medium text-gray-700";

interface Attachment {
  key: string;
  fileItemId?: string;
  driveFileId?: string;
  url?: string;
  name: string;
  size?: number | null;
}
interface Draft {
  prj: string;
  parentId: string;
  parentTitle: string;
  issueType: IssueType;
  title: string;
  body: string;
  priority: number;
  assigneeId: string;
  participantIds: string[];
  startDate: string;
  dueDate: string;
  doneRatio: number;
  attachments: Attachment[];
  savedAt?: string;
}

const formatSize = (b?: number | null) =>
  b == null ? "" : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
const storage = {
  get(key: string): Draft | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Draft) : null;
    } catch {
      return null;
    }
  },
  set(key: string, v: Draft) {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/**
 * REQ-261016C — 이슈 등록/수정 (AMA IssueFormModal 동일 구성).
 * 프로젝트·상위 이슈 검색 / 유형 / 제목 / 리치 텍스트 설명 / 우선순위·담당자 / 관련자 /
 * 파일 첨부(업로드·URL) / 해결 방법(수정 시) / 시작일·마감일·진행률 / 3초 임시 저장.
 */
export function IssueFormDialog({
  issue,
  projectId,
  close,
  onSaved,
}: {
  issue?: Issue | IssueDetail;
  projectId?: string;
  close: () => void;
  onSaved?: (id: string, title: string) => void;
}) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const scope = useScope();
  const me = useAuthStore((s) => s.user?.id);
  const draftKey = `acm_issue_draft:${me ?? ""}`;
  const projects = useQuery({
    queryKey: ["prj", ...scope],
    queryFn: async () => (await apiClient.get<Project[]>(`${issueBase}/projects`)).data,
  });
  const existingAttachments = (issue as IssueDetail | undefined)?.attachments;
  const empty: Draft = {
    prj: issue?.prj_id ?? projectId ?? "",
    parentId: issue?.pit_parent_id ?? "",
    parentTitle: issue?.parent_title ?? "",
    issueType: issue?.pit_issue_type ?? "TASK",
    title: issue?.pit_title ?? "",
    body: issue?.pit_body ?? "",
    priority: issue?.pit_priority ?? 3,
    assigneeId: issue?.assignee_id ?? "",
    participantIds: issue?.participant_ids ?? [],
    startDate: day(issue?.start_date),
    dueDate: day(issue?.due_date),
    doneRatio: issue?.pit_done_ratio ?? 0,
    attachments: (existingAttachments ?? []).map((a: IssueAttachment) => ({
      key: a.pia_id,
      fileItemId: a.file_item_id ?? undefined,
      url: a.pia_url ?? undefined,
      name: a.pia_name,
      size: a.pia_size == null ? null : Number(a.pia_size),
    })),
  };
  const [form, setForm] = useState<Draft>(empty);
  const [resolution, setResolution] = useState(issue?.pit_resolution ?? "");
  const [draft, setDraft] = useState<Draft | null>(() => {
    if (issue) return null;
    const d = storage.get(draftKey);
    return d && (d.title.trim() || !isBlankHtml(d.body)) ? d : null;
  });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };
  const detail = useQuery({
    enabled: !!form.prj,
    queryKey: ["prj", form.prj, ...scope],
    queryFn: async () => (await apiClient.get<Project>(`${issueBase}/projects/${form.prj}`)).data,
  });
  const members = detail.data?.members ?? [];

  // 새 이슈: 3초마다 임시 저장 (AMA amb_issue_draft)
  const formRef = useRef(form);
  formRef.current = form;
  const saveDraft = useCallback(() => {
    const d = formRef.current;
    if (issue || (!d.title.trim() && isBlankHtml(d.body))) return;
    storage.set(draftKey, { ...d, savedAt: new Date().toISOString() });
  }, [issue, draftKey]);
  useEffect(() => {
    if (issue) return;
    const timer = setInterval(saveDraft, 3000);
    return () => clearInterval(timer);
  }, [issue, saveDraft]);

  // 담당자: 프로젝트 참여자가 아니면 비우고, 새 이슈는 프로젝트를 처음 고를 때 나를 기본 담당자로 (AMA 기본값)
  const defaultedFor = useRef(issue ? (issue.prj_id ?? "") : "");
  useEffect(() => {
    if (!detail.data) return;
    const ids = members.map((m) => m.id);
    if (form.assigneeId && !ids.includes(form.assigneeId)) setForm((f) => ({ ...f, assigneeId: "" }));
    else if (!form.assigneeId && me && ids.includes(me) && defaultedFor.current !== form.prj)
      setForm((f) => ({ ...f, assigneeId: me }));
    defaultedFor.current = form.prj;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data]);

  const dismiss = () => {
    if (busy) return;
    if (!issue) {
      saveDraft();
      close();
    } else if (!dirty || window.confirm(t("issues.form.discard"))) close();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const submit = async () => {
    if (!form.prj || !form.title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        kind: "ISSUE",
        title: form.title.trim(),
        body: isBlankHtml(form.body) ? "" : form.body,
        issueType: form.issueType,
        priority: Number(form.priority),
        ...(issue ? {} : { assigneeId: form.assigneeId || null }),
        participantIds: form.participantIds.filter((p) => p !== form.assigneeId),
        parentId: form.parentId || null,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        doneRatio: form.doneRatio,
        ...(issue ? { resolution } : {}),
        attachments: form.attachments.map(({ fileItemId, driveFileId, url, name }) => ({
          fileItemId,
          driveFileId,
          url,
          name,
        })),
      };
      const url = `${issueBase}/projects/${form.prj}/items`;
      const saved = issue
        ? (await apiClient.put<{ pit_id: string }>(`${url}/${issue.pit_id}`, body)).data
        : (await apiClient.post<{ pit_id: string }>(url, body)).data;
      if (!issue) storage.remove(draftKey);
      await qc.invalidateQueries({ queryKey: ["prj"] });
      setDirty(false);
      onSaved?.(saved.pit_id, body.title);
      close();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const projectOptions = (projects.data ?? []).filter((p) => p.prj_status !== "ARCHIVED" || p.prj_id === form.prj);
  const projectName = (p?: Project) => (p ? (p.prj_code ? `[${p.prj_code}] ${p.prj_title}` : p.prj_title) : "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && dismiss()}>
      <div role="dialog" aria-modal="true" aria-labelledby="issue-form-title" className="mx-4 w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 id="issue-form-title" className="text-lg font-semibold text-gray-900">
            {issue ? t("issues.form.editTitle") : t("issues.form.createTitle")}
          </h2>
          <button type="button" aria-label={t("issues.form.cancel")} onClick={dismiss} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {draft && (
          <div className="mx-6 mt-3 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
            <RotateCcw className="h-4 w-4 flex-shrink-0 text-amber-600" />
            <p className="min-w-0 flex-1 text-sm text-amber-800">
              {t("issues.form.draftFound")}
              {draft.savedAt && <span className="ml-1 text-xs text-amber-600">({new Date(draft.savedAt).toLocaleString()})</span>}
            </p>
            <button
              type="button"
              onClick={() => {
                setForm({ ...empty, ...draft, prj: projectId ?? draft.prj });
                setDraft(null);
                setDirty(true);
              }}
              className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
            >
              {t("issues.form.draftRestore")}
            </button>
            <button
              type="button"
              onClick={() => {
                storage.remove(draftKey);
                setDraft(null);
              }}
              className="rounded border border-amber-300 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              {t("issues.form.draftDiscard")}
            </button>
          </div>
        )}

        <form
          className="max-h-[75vh] space-y-4 overflow-y-auto px-6 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {/* Row 1: 프로젝트 / 상위 이슈 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative">
              <span className={label}>{t("issues.fields.project")}</span>
              <SearchCombo
                value={form.prj}
                selectedLabel={projectName(projectOptions.find((p) => p.prj_id === form.prj))}
                locked={!!issue || !!projectId}
                placeholder={t("issues.form.searchProjectPlaceholder")}
                emptyText={t("issues.form.noMatch")}
                options={(q) =>
                  projectOptions
                    .filter((p) => !q || p.prj_title.toLowerCase().includes(q) || p.prj_code?.toLowerCase().includes(q))
                    .map((p) => ({
                      id: p.prj_id,
                      node: (
                        <>
                          {p.prj_code && <span className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{p.prj_code}</span>}
                          <span className="flex-1 truncate text-gray-700">{p.prj_title}</span>
                        </>
                      ),
                    }))
                }
                onChange={(id) => {
                  setForm((f) => ({ ...f, prj: id, parentId: "", parentTitle: "", participantIds: [], attachments: f.attachments.filter((a) => !a.fileItemId && !a.driveFileId) }));
                  setDirty(true);
                }}
              />
            </div>
            <ParentPicker
              prj={form.prj}
              selfId={issue?.pit_id}
              value={form.parentId}
              title={form.parentTitle}
              onChange={(id, title) => {
                setForm((f) => ({ ...f, parentId: id, parentTitle: title }));
                setDirty(true);
              }}
            />
          </div>

          {/* Row 2: 유형 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={label}>{t("issues.fields.type")}</span>
              <select className={input} value={form.issueType} onChange={(e) => set("issueType", e.target.value as IssueType)}>
                {ISSUE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(`issues.type.${v}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Row 3: 제목 */}
          <label className="block">
            <span className={label}>{t("issues.fields.title")}</span>
            <input
              required
              maxLength={200}
              className={input}
              value={form.title}
              placeholder={t("issues.form.titlePlaceholder")}
              onChange={(e) => set("title", e.target.value)}
            />
          </label>

          {/* Row 4: 설명 */}
          <div>
            <span className={label}>{t("issues.fields.description")}</span>
            <IssueRichEditor
              value={form.body}
              onChange={(v) => set("body", v)}
              placeholder={t("issues.form.descriptionPlaceholder")}
              mentionCandidates={members}
            />
          </div>

          {/* Row 5: 우선순위 / 담당자 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={label}>{t("issues.fields.priority")}</span>
              <select className={input} value={form.priority} onChange={(e) => set("priority", Number(e.target.value))}>
                {PRIORITIES.map((v) => (
                  <option key={v} value={v}>
                    {t(`issues.priority.${v}`)}
                  </option>
                ))}
              </select>
            </label>
            {/* REQ-261016D — 검색 없이 참여자 목록에서 선택. 수정 시 담당 변경은 상세의 [지정]으로 */}
            {issue ? (
              <div>
                <span className={label}>{t("issues.fields.assignee")}</span>
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {members.find((m) => m.id === form.assigneeId)?.name ?? issue.assignee_name ?? t("issues.unassigned")}
                </p>
                <p className="mt-1 text-xs text-gray-400">{t("issues.form.assigneeInDetail")}</p>
              </div>
            ) : (
              <label className="block">
                <span className={label}>{t("issues.fields.assignee")}</span>
                <select
                  className={input}
                  value={form.assigneeId}
                  disabled={!form.prj}
                  onChange={(e) => {
                    const id = e.target.value;
                    setForm((f) => ({ ...f, assigneeId: id, participantIds: f.participantIds.filter((p) => p !== id) }));
                    setDirty(true);
                  }}
                >
                  <option value="">{form.prj ? t("issues.form.unassignedOption") : t("issues.form.pickProjectFirst")}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.id === me ? ` ${t("issues.form.me")}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* Row 5.5: 관련자 — REQ-261016D 목록 체크 */}
          <fieldset>
            <legend className={label}>{t("issues.fields.participants")}</legend>
            {!form.prj ? (
              <p className="text-xs text-gray-400">{t("issues.form.pickProjectFirst")}</p>
            ) : (
              <>
                <p className="mb-1.5 text-xs text-gray-400">{t("issues.form.participantsHint")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {members
                    .filter((m) => m.id !== form.assigneeId)
                    .map((m) => {
                      const on = form.participantIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                            on ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-indigo-600"
                            checked={on}
                            onChange={() =>
                              set("participantIds", on ? form.participantIds.filter((p) => p !== m.id) : [...form.participantIds, m.id])
                            }
                          />
                          {m.name}
                        </label>
                      );
                    })}
                </div>
              </>
            )}
          </fieldset>

          {/* Row 6: 파일 첨부 */}
          <Attachments
            prj={form.prj}
            value={form.attachments}
            onChange={(v) => set("attachments", v)}
          />

          {issue && (
            <label className="block">
              <span className={label}>{t("issues.fields.resolution")}</span>
              <textarea
                rows={2}
                maxLength={10000}
                className={input}
                value={resolution}
                placeholder={t("issues.form.resolutionPlaceholder")}
                onChange={(e) => {
                  setResolution(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
          )}

          {/* 기간·진행률 */}
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={label}>{t("issues.fields.startDate")}</span>
              <input type="date" className={input} value={form.startDate} max={form.dueDate || undefined} onChange={(e) => set("startDate", e.target.value)} />
            </label>
            <label className="block">
              <span className={label}>{t("issues.fields.dueDate")}</span>
              <input type="date" className={input} value={form.dueDate} min={form.startDate || undefined} onChange={(e) => set("dueDate", e.target.value)} />
            </label>
            <label className="block">
              <span className={label}>
                {t("issues.form.doneRatio")} ({form.doneRatio}%)
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                value={form.doneRatio}
                onChange={(e) => set("doneRatio", Number(e.target.value))}
                className="mt-2 w-full accent-indigo-600"
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={dismiss} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              {t("issues.form.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy || !form.prj || !form.title.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {issue ? t("issues.form.save") : t("issues.add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** AMA 검색 콤보: 선택 시 회색 칩 + ✕, 아니면 돋보기 입력 + 드롭다운. */
function SearchCombo({
  value,
  selectedLabel,
  locked,
  lockedText,
  placeholder,
  emptyText,
  options,
  onChange,
}: {
  value: string;
  selectedLabel: string;
  locked?: boolean;
  lockedText?: string;
  placeholder: string;
  emptyText: string;
  options: (q: string) => { id: string; node: ReactNode }[];
  onChange: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const list = useMemo(() => (open ? options(q.trim().toLowerCase()) : []), [open, q, options]);
  if (value)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
        <span className="flex-1 truncate text-gray-700">{selectedLabel || "—"}</span>
        {!locked && (
          <button type="button" aria-label="clear" onClick={() => onChange("")} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={q}
        disabled={locked}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={locked && lockedText ? lockedText : placeholder}
        aria-label={placeholder}
        className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {list.length ? (
            list.map((o) => (
              <button
                key={o.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.id);
                  setQ("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50"
              >
                {o.node}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-gray-400">{emptyText}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** 상위 이슈 검색 — 프로젝트를 고르면 검색어 없이도 그 프로젝트 이슈를 보여준다. */
function ParentPicker({
  prj,
  selfId,
  value,
  title,
  onChange,
}: {
  prj: string;
  selfId?: string;
  value: string;
  title: string;
  onChange: (id: string, title: string) => void;
}) {
  const { t } = useTranslation("common");
  const scope = useScope();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q.trim()), 500);
    return () => clearTimeout(timer);
  }, [q]);
  const result = useQuery({
    enabled: open && !!prj,
    queryKey: ["prj", "parent-search", prj, debounced, ...scope],
    queryFn: async () =>
      (
        await apiClient.get<{ items: Issue[] }>(`${issueBase}/issues`, {
          params: { projectId: prj, q: debounced || undefined, limit: 10, sort: "updated_desc" },
        })
      ).data.items.filter((i) => i.pit_id !== selfId),
  });
  return (
    <div className="relative">
      <span className={label}>{t("issues.fields.parentIssue")}</span>
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
          <span className="flex-1 truncate text-gray-700">{title || "—"}</span>
          <button type="button" aria-label="clear" onClick={() => onChange("", "")} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={q}
            disabled={!prj}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={prj ? t("issues.form.parentIssuePlaceholder") : t("issues.form.pickProjectFirst")}
            aria-label={t("issues.form.parentIssuePlaceholder")}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
          />
          {open && !!result.data?.length && (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {result.data.map((i) => (
                <button
                  key={i.pit_id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(i.pit_id, i.pit_title);
                    setQ("");
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50"
                >
                  <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_CHIP[i.pit_issue_type]}`}>
                    {t(`issues.type.${i.pit_issue_type}`)}
                  </span>
                  <span className="flex-1 truncate text-gray-700">{i.pit_title}</span>
                  {i.pit_ref_no && <span className="text-xs text-gray-400">{refLabel(i.pit_ref_no)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 파일 첨부 — [파일 업로드] 프로젝트 파일(회사 Drive 또는 ACM 저장소) / [URL 등록]. */
function Attachments({
  prj,
  value,
  onChange,
}: {
  prj: string;
  value: Attachment[];
  onChange: (v: Attachment[]) => void;
}) {
  const { t } = useTranslation("common");
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const upload = async (files: FileList | null) => {
    if (!files?.length || !prj) return;
    setUploading(true);
    setUploadError("");
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("title", file.name.slice(0, 200));
        fd.append("phase", "ETC");
        fd.append("operationId", crypto.randomUUID());
        const res = (
          await apiClient.post<{ pit_id?: string; id?: string; name?: string; size?: string | number }>(
            `${issueBase}/projects/${prj}/files`,
            fd,
            { headers: { "Content-Type": "multipart/form-data" } },
          )
        ).data;
        const a: Attachment = res.pit_id
          ? { key: res.pit_id, fileItemId: res.pit_id, name: file.name, size: file.size }
          : { key: res.id ?? file.name, driveFileId: res.id, name: res.name ?? file.name, size: file.size };
        valueRef.current = [...valueRef.current, a];
        onChange(valueRef.current);
      }
    } catch (err) {
      setUploadError(errorText(err) || t("issues.form.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const addUrl = () => {
    const v = url.trim();
    if (!/^https?:\/\/\S+$/i.test(v)) return;
    onChange([...value, { key: v, url: v, name: v.slice(0, 255) }]);
    setUrl("");
  };
  const tabCls = (on: boolean) =>
    `flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
      on ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
    }`;
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void upload(e.dataTransfer.files);
  };
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-gray-700">{t("issues.form.fileAttachment")}</span>
      <div className="mb-3 flex border-b border-gray-200">
        <button type="button" onClick={() => setTab("upload")} className={tabCls(tab === "upload")}>
          <Upload className="h-4 w-4" />
          {t("issues.form.tabFileUpload")}
        </button>
        <button type="button" onClick={() => setTab("url")} className={tabCls(tab === "url")}>
          <LinkIcon className="h-4 w-4" />
          {t("issues.form.tabUrlRegister")}
        </button>
      </div>
      {tab === "upload" ? (
        <div className="space-y-2">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
          <div
            role="button"
            tabIndex={0}
            aria-disabled={!prj || uploading}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => prj && !uploading && fileRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && prj && !uploading && fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors ${
              dragOver
                ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                : "border-gray-300 text-gray-500 hover:border-indigo-400 hover:bg-gray-50 hover:text-indigo-600"
            } ${uploading || !prj ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <span>{t("issues.form.uploading")}</span>
              </>
            ) : (
              <>
                <Upload className={`h-8 w-8 ${dragOver ? "text-indigo-500" : "text-gray-400"}`} />
                <span className="font-medium">{prj ? t("issues.form.dragDropText") : t("issues.form.pickProjectFirst")}</span>
                <span className="text-xs text-gray-400">{t("issues.form.uploadHint")}</span>
              </>
            )}
          </div>
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ExternalLink className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addUrl();
                  }
                }}
                placeholder={t("issues.form.urlPlaceholder")}
                aria-label={t("issues.form.urlPlaceholder")}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button type="button" onClick={addUrl} className="rounded-lg border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50">
              {t("issues.form.urlAdd")}
            </button>
          </div>
          <p className="text-xs text-gray-400">{t("issues.form.urlHint")}</p>
        </div>
      )}
      {value.length > 0 && (
        <ul className="mt-2 space-y-1">
          {value.map((a) => (
            <li key={a.key} className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
              {a.url ? <LinkIcon className="h-4 w-4 flex-shrink-0 text-indigo-500" /> : <FileText className="h-4 w-4 flex-shrink-0 text-indigo-500" />}
              <span className="flex-1 truncate text-indigo-600">{a.name}</span>
              <span className="flex-shrink-0 text-xs text-gray-400">{formatSize(a.size)}</span>
              <button
                type="button"
                aria-label={t("issues.delete")}
                onClick={() => onChange(value.filter((x) => x.key !== a.key))}
                className="flex-shrink-0 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
