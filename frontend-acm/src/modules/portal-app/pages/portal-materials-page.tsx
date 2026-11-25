import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FilePen,
  FileText,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Search,
  Paperclip,
  Plus,
  Send,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  portalApi,
  type MaterialComment,
  type PortalMaterialPost,
} from "../api/portal-api";
import { SharePanel, type ShareDraft } from "./portal-doc-page";

// REQ-260728B — 문서 첨부 UI(portal-doc-page)에서도 재사용 (export).
export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Tab = "shared" | "own";

export function PortalMaterialsPage() {
  const { t } = useTranslation("common");
  const kind = useAuthStore((s) => s.portal.user?.kind);
  const canAuthor = kind === "TEACHER" || kind === "STUDENT";
  const [params, setParams] = useSearchParams();
  const tab: Tab =
    params.get("scope") === "own" && canAuthor ? "own" : "shared";
  const setTab = (scope: Tab) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("scope", scope);
        next.delete("page");
        return next;
      },
      { replace: true },
    );

  return (
    <div>
      <h1 className="portal-title">{t("portalApp.nav.materials")}</h1>

      {/* Tabs */}
      <div className="portal-tabs">
        <button
          type="button"
          aria-pressed={tab === "shared"}
          onClick={() => setTab("shared")}
          className={`min-h-9 rounded px-3 py-1 sm:min-h-0 ${tab === "shared" ? "bg-accent-600 text-white" : "text-secondary"}`}
        >
          {t("portalApp.materials.tabShared", "공유받은 게시물")}
        </button>
        {canAuthor && (
          <button
            type="button"
            aria-pressed={tab === "own"}
            onClick={() => setTab("own")}
            className={`min-h-9 rounded px-3 py-1 sm:min-h-0 ${tab === "own" ? "bg-accent-600 text-white" : "text-secondary"}`}
          >
            {t("portalApp.materials.tabOwn", "내 게시물")}
          </button>
        )}
      </div>

      {tab === "own" && canAuthor && (
        <div className="mb-4 flex flex-wrap items-start gap-2">
          {/* PLN-260719 B — 리치에디터 문서 작성 */}
          <Link
            to="/portal/materials/docs/new"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-accent-700 hover:bg-[var(--gray-50)]"
          >
            <FilePen size={14} /> {t("portalApp.materials.newDoc", "새 문서")}
          </Link>
          <CreateForm kind={kind} />
        </div>
      )}
      <MaterialList scope={tab} />
    </div>
  );
}

function CreateForm({ kind }: { kind: "TEACHER" | "STUDENT" }) {
  void kind; // 공유후보는 서버가 역할별로 필터 (REQ-260728B FR-1: 학생→강사만).
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  // REQ-260728B FR-3 — 업로드 시점에 공유대상 필수 선택.
  const [shares, setShares] = useState<ShareDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      portalApi.createMaterial(
        file!,
        title,
        shares.map((s) => ({ kind: s.kind, refId: s.refId, role: s.role })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-materials", "own"] });
      setFile(null);
      setTitle("");
      setShares([]);
      setOpen(false);
      setError(null);
    },
    onError: (e) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(
        err.response?.data?.message ??
          t("common:status.error", "오류가 발생했습니다."),
      );
    },
  });

  const canSubmit = !!file && shares.length > 0 && !create.isPending;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-accent-700 hover:bg-[var(--gray-50)]"
      >
        <Plus size={14} /> {t("portalApp.materials.newFile", "파일 업로드")}
      </button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-md border border-[var(--border-subtle)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary">
          {t("portalApp.materials.newPost", "새 게시물")}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-2 text-secondary sm:p-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* File */}
      <div
        onClick={() => fileRef.current?.click()}
        className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-[var(--border-subtle)] px-3 py-3 text-sm text-secondary hover:border-accent-500"
      >
        <Paperclip size={14} />
        {file ? (
          <span className="truncate text-primary">
            {file.name} ({fmtSize(file.size)})
          </span>
        ) : (
          t("portalApp.materials.pickFile", "파일 선택 (≤50MB)")
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t(
          "portalApp.materials.titlePlaceholder",
          "제목 (생략 시 파일명)",
        )}
        className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm"
      />

      {/* REQ-260728B FR-3 — 공유대상 1명 이상 선택해야 업로드 가능 */}
      <SharePanel shares={shares} onChange={setShares} showRoles={false} />
      {shares.length === 0 && (
        <p className="rounded-md bg-[var(--gray-50)] px-3 py-2 text-xs text-secondary">
          {t(
            "portalApp.materials.shareRequiredHint",
            "공유 대상을 1명 이상 선택해야 업로드할 수 있습니다.",
          )}
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => create.mutate()}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {create.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          {t("portalApp.materials.uploadBtn", "업로드")}
        </button>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;
type KindFilter = "ALL" | "DOC" | "FILE";

function MaterialList({ scope }: { scope: Tab }) {
  const { t } = useTranslation("common");
  // REQ-260728B FR-4 — 문서/자료 구분 필터 + 서버 페이징.
  const [params, setParams] = useSearchParams();
  const user = useAuthStore((state) => state.portal.user);
  const kindFilter: KindFilter =
    params.get("kind") === "DOC"
      ? "DOC"
      : params.get("kind") === "FILE"
        ? "FILE"
        : "ALL";
  const parsedPage = Number(params.get("page"));
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const search = (params.get("q") ?? "").slice(0, 100);
  const [draft, setDraft] = useState(search);
  useEffect(() => setDraft(search), [search]);
  const update = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== "page") next.delete("page");
        return next;
      },
      { replace: true },
    );
  const setKindFilter = (kind: KindFilter) =>
    update("kind", kind === "ALL" ? "" : kind);
  const setPage = (value: number) => update("page", String(value));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "portal-materials",
      scope,
      user?.entId,
      user?.refId,
      user?.kind,
      kindFilter,
      page,
      search,
    ],
    queryFn: () =>
      portalApi.materials(scope, {
        kind: kindFilter === "ALL" ? undefined : kindFilter,
        page,
        limit: PAGE_SIZE,
        q: search || undefined,
      }),
  });
  const posts = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filters: Array<{ key: KindFilter; label: string }> = [
    { key: "ALL", label: t("portalApp.materials.filterAll", "전체") },
    { key: "DOC", label: t("portalApp.materials.filterDoc", "문서") },
    { key: "FILE", label: t("portalApp.materials.filterFile", "자료") },
  ];

  return (
    <div>
      <div className="portal-toolbar">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={kindFilter === f.key}
            onClick={() => setKindFilter(f.key)}
            className={`min-h-9 rounded px-2.5 py-1 sm:min-h-0 ${
              kindFilter === f.key
                ? "bg-accent-600 text-white"
                : "text-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <form
        className="portal-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          update("q", draft.trim());
        }}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <Search size={18} aria-hidden />
          <input
            className="w-full"
            type="search"
            maxLength={100}
            aria-label={t("portalUi.materialSearch")}
            placeholder={t("portalUi.materialSearch")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <button type="submit">{t("portalUi.search")}</button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              update("q", "");
            }}
          >
            {t("portalUi.clear")}
          </button>
        )}
        {!isLoading && !isError && (
          <span className="text-sm text-secondary" role="status">
            {t("portalUi.resultCount", { count: total })}
          </span>
        )}
      </form>
      {isError ? (
        <div role="alert" className="portal-empty">
          {t("portalUi.loadError")}{" "}
          <button onClick={() => void refetch()}>
            {t("portalApp.cal.retry")}
          </button>
        </div>
      ) : isLoading ? (
        <p className="py-6 text-center text-sm text-secondary">…</p>
      ) : posts.length === 0 ? (
        <p className="rounded-md border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
          {search ? t("portalUi.noMatches") : t("portalApp.materials.empty")}
        </p>
      ) : (
        <div className="portal-material-table">
          <table>
            <caption className="sr-only">
              {t("portalApp.nav.materials")}
            </caption>
            <thead>
              <tr>
                <th>{t("portalUi.title")}</th>
                <th>{t("portalUi.type")}</th>
                <th className="portal-material-author">
                  {t("portalApp.materials.author")}
                </th>
                <th className="portal-material-date">
                  {t("portalUi.created")}
                </th>
                <th>{t("portalUi.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <MaterialCard key={post.id} post={post} scope={scope} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  // 현재 페이지 주변 최대 5개 번호만 노출.
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const nums = Array.from(
    { length: Math.min(5, totalPages) },
    (_, i) => start + i,
  );
  const navBtn =
    "inline-flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded border border-[var(--border-subtle)] text-secondary hover:bg-[var(--gray-50)] disabled:opacity-40";
  return (
    <div className="mt-4 flex items-center justify-center gap-1 text-xs">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={navBtn}
      >
        <ChevronLeft size={13} />
      </button>
      {nums.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`inline-flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded ${
            n === page
              ? "bg-accent-600 font-medium text-white"
              : "border border-[var(--border-subtle)] text-secondary hover:bg-[var(--gray-50)]"
          }`}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className={navBtn}
      >
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

function MaterialCard({
  post,
  scope,
}: {
  post: PortalMaterialPost;
  scope: Tab;
}) {
  const { t, i18n } = useTranslation("common");
  const confirm = useConfirm();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [showComments, setShowComments] = useState(false);
  // PLN-260724 — 파일도 문서와 동일하게 업로드 후 공유대상 지정.
  const [showShare, setShowShare] = useState(false);
  const [shareDraft, setShareDraft] = useState<ShareDraft[]>([]);
  const isDoc = post.kind === "DOC";

  const sharesMut = useMutation({
    mutationFn: () =>
      portalApi.updateMaterialShares(
        post.id,
        shareDraft.map((s) => ({ kind: s.kind, refId: s.refId, role: s.role })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-materials"] });
      setShowShare(false);
    },
  });

  const openShare = () => {
    setShareDraft(
      post.shareTargets.map((s) => ({
        kind: s.kind,
        refId: s.refId,
        name: s.name,
        role: s.role,
      })),
    );
    setShowShare(true);
  };

  const del = useMutation({
    mutationFn: () => portalApi.deleteMaterial(post.id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["portal-materials", scope] }),
  });

  const onDownload = async () => {
    if (!post.filename) return;
    setDownloading(true);
    setActionError(false);
    try {
      await portalApi.downloadMaterial(post.id, post.filename);
    } catch {
      setActionError(true);
    } finally {
      setDownloading(false);
    }
  };

  const sharedNames = post.shareTargets.map((s) => s.name).join(", ");

  return (
    <>
      <tr>
        <td className="portal-material-title">
          <div className="flex items-start gap-3">
            {isDoc ? (
              <FilePen size={20} className="shrink-0 text-accent-600" />
            ) : (
              <FileText size={20} className="shrink-0 text-secondary" />
            )}
            <div className="min-w-0">
              {isDoc ? (
                <button
                  type="button"
                  onClick={() => navigate("/portal/materials/docs/" + post.id)}
                  className="break-words text-left text-sm font-semibold text-accent-700 hover:underline"
                >
                  {post.title}
                </button>
              ) : (
                <strong className="block break-words text-sm">
                  {post.title}
                </strong>
              )}
              <p className="mt-1 break-words text-xs text-secondary">
                {!isDoc && post.filename
                  ? post.filename + " · " + fmtSize(post.sizeBytes ?? 0)
                  : scope === "own"
                    ? sharedNames
                    : ""}
              </p>
              {post.isSubmission && (
                <span className="portal-status">
                  {t("portalApp.materials.submission")}
                </span>
              )}
            </div>
          </div>
        </td>
        <td>
          <span className="portal-status">
            {t(
              isDoc
                ? "portalApp.materials.docBadge"
                : "portalApp.materials.filterFile",
            )}
          </span>
        </td>
        <td className="portal-material-author text-sm text-secondary">
          {post.authorName || t("portalUi.notEntered")}
        </td>
        <td className="portal-material-date text-xs text-secondary">
          {new Date(post.createdAt).toLocaleDateString(i18n.language)}
        </td>
        <td>
          <div className="portal-material-actions">
            <button
              type="button"
              aria-expanded={showComments}
              aria-label={
                t("portalApp.materials.comments") +
                " (" +
                post.commentCount +
                ")"
              }
              title={t("portalApp.materials.comments")}
              onClick={() => setShowComments((v) => !v)}
            >
              <MessageSquare size={17} aria-hidden />
              <span className="text-xs">{post.commentCount}</span>
            </button>
            <details
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.currentTarget.removeAttribute("open");
                  event.currentTarget.querySelector("summary")?.focus();
                }
              }}
            >
              <summary
                aria-label={t("portalUi.more")}
                title={t("portalUi.more")}
              >
                <MoreHorizontal size={20} aria-hidden />
              </summary>
              <div className="portal-material-menu">
                {!isDoc && (
                  <button
                    type="button"
                    onClick={() => void onDownload()}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    {t("portalApp.materials.download")}
                  </button>
                )}
                {isDoc && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/portal/materials/docs/" + post.id)
                    }
                  >
                    <FilePen size={16} />
                    {t("portalUi.open")}
                  </button>
                )}
                {post.mine && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      openShare();
                    }}
                  >
                    <Share2 size={16} />
                    {t("portalApp.materials.shareBtn2")}
                  </button>
                )}
                {post.mine && (
                  <button
                    type="button"
                    disabled={del.isPending}
                    className="text-red-600"
                    onClick={async () => {
                      const ok = await confirm({
                        title: t("portalApp.materials.confirmDelete"),
                        description: t("confirm.deleteDescription"),
                        variant: "destructive",
                      });
                      if (ok) del.mutate();
                    }}
                  >
                    <Trash2 size={16} />
                    {t("actions.delete")}
                  </button>
                )}
              </div>
            </details>
          </div>
        </td>
      </tr>
      {(showShare ||
        showComments ||
        del.isError ||
        sharesMut.isError ||
        actionError) && (
        <tr>
          <td colSpan={5} className="portal-material-details">
            {(del.isError || sharesMut.isError || actionError) && (
              <p role="alert" className="text-sm text-red-600">
                {t("portalUi.loadError")}
              </p>
            )}
            {showShare && (
              <div className="mt-3 space-y-2">
                <SharePanel
                  shares={shareDraft}
                  onChange={setShareDraft}
                  showRoles={isDoc}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowShare(false)}
                    className="min-h-9 rounded-md border border-[var(--border-subtle)] px-3 py-1 text-xs text-secondary sm:min-h-0"
                  >
                    {t("actions.cancel", "취소")}
                  </button>
                  <button
                    type="button"
                    disabled={sharesMut.isPending}
                    onClick={() => sharesMut.mutate()}
                    className="inline-flex min-h-9 items-center gap-1 rounded-md bg-accent-600 px-3 py-1 text-xs sm:min-h-0 text-white disabled:opacity-50"
                  >
                    {sharesMut.isPending && (
                      <Loader2 size={12} className="animate-spin" />
                    )}
                    {t("portalApp.materials.shareSave", "공유 저장")}
                  </button>
                </div>
              </div>
            )}

            {showComments && <CommentThread matId={post.id} />}
          </td>
        </tr>
      )}
    </>
  );
}

// PLN-260719 B — 문서 상세 페이지에서도 재사용 (export).
export function CommentThread({ matId }: { matId: string }) {
  const { t, i18n } = useTranslation("common");
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["portal-material-comments", matId],
    queryFn: () => portalApi.materialComments(matId),
  });

  const add = useMutation({
    mutationFn: () => portalApi.addMaterialComment(matId, body),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["portal-material-comments", matId] });
      qc.invalidateQueries({ queryKey: ["portal-materials"] });
    },
  });

  const list = useMemo(() => comments as MaterialComment[], [comments]);

  return (
    <div className="mt-2 space-y-2 rounded-md bg-[var(--gray-50)] p-2">
      {isLoading ? (
        <p className="text-xs text-secondary">…</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-secondary">
          {t("portalApp.materials.noComments", "아직 댓글이 없습니다.")}
        </p>
      ) : (
        list.map((c) => (
          <div key={c.id} className="text-xs">
            <span className="font-medium text-primary">{c.authorName}</span>
            <span className="ml-1 text-secondary">
              {new Date(c.createdAt).toLocaleString(i18n.language)}
            </span>
            <div className="whitespace-pre-wrap text-primary">{c.body}</div>
          </div>
        ))
      )}

      <div className="flex items-center gap-1.5 pt-1">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && body.trim()) add.mutate();
          }}
          placeholder={t(
            "portalApp.materials.commentPlaceholder",
            "댓글 입력…",
          )}
          className="h-9 sm:h-8 flex-1 rounded-md border border-[var(--border-subtle)] bg-canvas px-2 text-xs"
        />
        <button
          type="button"
          disabled={!body.trim() || add.isPending}
          onClick={() => add.mutate()}
          className="inline-flex min-h-9 items-center gap-1 rounded-md bg-accent-600 px-2 py-1.5 text-xs sm:min-h-0 text-white disabled:opacity-50"
        >
          {add.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Send size={12} />
          )}
        </button>
      </div>
    </div>
  );
}
