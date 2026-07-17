import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import {
  portalApi,
  type MaterialComment,
  type PortalMaterialPost,
} from '../api/portal-api';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Tab = 'shared' | 'own';

export function PortalMaterialsPage() {
  const { t } = useTranslation('common');
  const kind = useAuthStore((s) => s.portal.user?.kind);
  const canAuthor = kind === 'TEACHER' || kind === 'STUDENT';
  const [tab, setTab] = useState<Tab>('shared');

  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold text-primary">
        {t('portalApp.nav.materials')}
      </h1>

      {/* Tabs */}
      <div className="mb-4 inline-flex rounded-md border border-[var(--border-subtle)] p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setTab('shared')}
          className={`rounded px-3 py-1 ${tab === 'shared' ? 'bg-accent-600 text-white' : 'text-secondary'}`}
        >
          {t('portalApp.materials.tabShared', '공유받은 게시물')}
        </button>
        {canAuthor && (
          <button
            type="button"
            onClick={() => setTab('own')}
            className={`rounded px-3 py-1 ${tab === 'own' ? 'bg-accent-600 text-white' : 'text-secondary'}`}
          >
            {t('portalApp.materials.tabOwn', '내 게시물')}
          </button>
        )}
      </div>

      {tab === 'own' && canAuthor && <CreateForm kind={kind} />}
      <MaterialList scope={tab} />
    </div>
  );
}

function CreateForm({ kind }: { kind: 'TEACHER' | 'STUDENT' }) {
  const { t } = useTranslation('common');
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { data: candidates = [] } = useQuery({
    queryKey: ['portal-material-candidates'],
    queryFn: portalApi.materialShareCandidates,
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      portalApi.createMaterial(file!, title, Array.from(selected)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-materials', 'own'] });
      setFile(null);
      setTitle('');
      setSelected(new Set());
      setOpen(false);
      setError(null);
    },
    onError: (e) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? t('common:status.error', '오류가 발생했습니다.'));
    },
  });

  const shareLabel =
    kind === 'TEACHER'
      ? t('portalApp.materials.shareToStudents', '공유할 학생')
      : t('portalApp.materials.shareToTeacher', '제출할 강사');
  const submitLabel =
    kind === 'TEACHER'
      ? t('portalApp.materials.shareBtn', '학생에게 공유')
      : t('portalApp.materials.submitBtn', '강사에게 제출');

  const toggle = (refId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(refId)) next.delete(refId);
      else next.add(refId);
      return next;
    });

  const canSubmit = !!file && selected.size > 0 && !create.isPending;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-accent-700 hover:bg-[var(--gray-50)]"
      >
        <Plus size={14} /> {t('portalApp.materials.newPost', '새 게시물')}
      </button>
    );
  }

  return (
    <div className="mb-4 space-y-3 rounded-md border border-[var(--border-subtle)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary">
          {t('portalApp.materials.newPost', '새 게시물')}
        </span>
        <button type="button" onClick={() => setOpen(false)} className="text-secondary">
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
          t('portalApp.materials.pickFile', '파일 선택 (≤20MB)')
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
        placeholder={t('portalApp.materials.titlePlaceholder', '제목 (생략 시 파일명)')}
        className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm"
      />

      {/* Share targets */}
      <div>
        <div className="mb-1 text-xs text-secondary">{shareLabel}</div>
        {candidates.length === 0 ? (
          <p className="text-xs text-secondary">
            {t('portalApp.materials.noCandidates', '공유 대상이 없습니다.')}
          </p>
        ) : (
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {candidates.map((c) => (
              <button
                key={c.refId}
                type="button"
                onClick={() => toggle(c.refId)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  selected.has(c.refId)
                    ? 'border-accent-600 bg-accent-600 text-white'
                    : 'border-[var(--border-subtle)] text-secondary hover:bg-[var(--gray-50)]'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => create.mutate()}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function MaterialList({ scope }: { scope: Tab }) {
  const { t } = useTranslation('common');
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['portal-materials', scope],
    queryFn: () => portalApi.materials(scope),
  });

  if (isLoading) return <p className="py-6 text-center text-sm text-secondary">…</p>;
  if (posts.length === 0) {
    return (
      <p className="rounded-md border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
        {t('portalApp.materials.empty')}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <MaterialCard key={p.id} post={p} scope={scope} />
      ))}
    </div>
  );
}

function MaterialCard({ post, scope }: { post: PortalMaterialPost; scope: Tab }) {
  const { t, i18n } = useTranslation('common');
  const qc = useQueryClient();
  const [downloading, setDownloading] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const del = useMutation({
    mutationFn: () => portalApi.deleteMaterial(post.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-materials', scope] }),
  });

  const onDownload = async () => {
    setDownloading(true);
    try {
      await portalApi.downloadMaterial(post.id, post.filename);
    } finally {
      setDownloading(false);
    }
  };

  const sharedNames = post.shareTargets.map((s) => s.name).join(', ');

  return (
    <div className="rounded-md border border-[var(--border-subtle)] p-3">
      <div className="flex items-start gap-3">
        <FileText size={18} className="mt-0.5 shrink-0 text-secondary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-primary">{post.title}</span>
            {post.isSubmission && (
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                {t('portalApp.materials.submission', '제출')}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-secondary">
            {post.filename} · {fmtSize(post.sizeBytes)} ·{' '}
            {new Date(post.createdAt).toLocaleDateString(i18n.language)}
          </div>
          <div className="mt-0.5 text-xs text-secondary">
            {scope === 'own'
              ? sharedNames
                ? `${t('portalApp.materials.sharedWith', '공유 대상')}: ${sharedNames}`
                : null
              : post.authorName
                ? `${t('portalApp.materials.author', '작성자')}: ${post.authorName}`
                : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-xs text-accent-700 hover:bg-[var(--gray-50)]"
          >
            {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {t('portalApp.materials.download')}
          </button>
          {post.mine && (
            <button
              onClick={() => {
                if (window.confirm(t('portalApp.materials.confirmDelete', '이 게시물을 삭제할까요?')))
                  del.mutate();
              }}
              disabled={del.isPending}
              className="rounded border border-[var(--border-subtle)] p-1 text-red-600 hover:bg-red-50"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowComments((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-xs text-secondary hover:text-accent-700"
      >
        <MessageSquare size={12} />
        {t('portalApp.materials.comments', '댓글')} ({post.commentCount})
      </button>

      {showComments && <CommentThread matId={post.id} />}
    </div>
  );
}

function CommentThread({ matId }: { matId: string }) {
  const { t, i18n } = useTranslation('common');
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['portal-material-comments', matId],
    queryFn: () => portalApi.materialComments(matId),
  });

  const add = useMutation({
    mutationFn: () => portalApi.addMaterialComment(matId, body),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['portal-material-comments', matId] });
      qc.invalidateQueries({ queryKey: ['portal-materials'] });
    },
  });

  const list = useMemo(() => comments as MaterialComment[], [comments]);

  return (
    <div className="mt-2 space-y-2 rounded-md bg-[var(--gray-50)] p-2">
      {isLoading ? (
        <p className="text-xs text-secondary">…</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-secondary">
          {t('portalApp.materials.noComments', '아직 댓글이 없습니다.')}
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
            if (e.key === 'Enter' && body.trim()) add.mutate();
          }}
          placeholder={t('portalApp.materials.commentPlaceholder', '댓글 입력…')}
          className="h-8 flex-1 rounded-md border border-[var(--border-subtle)] bg-canvas px-2 text-xs"
        />
        <button
          type="button"
          disabled={!body.trim() || add.isPending}
          onClick={() => add.mutate()}
          className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-2 py-1.5 text-xs text-white disabled:opacity-50"
        >
          {add.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </button>
      </div>
    </div>
  );
}
