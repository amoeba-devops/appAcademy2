import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  ChevronLeft,
  History,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Pencil,
  Quote,
  Redo2,
  RotateCcw,
  Search,
  Strikethrough,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import {
  portalApi,
  type DocShareInput,
  type MaterialShareRole,
  type PortalUserCandidate,
} from '../api/portal-api';
import { CommentThread } from './portal-materials-page';

/**
 * PLN-260719 B — 문서 게시글 뷰/편집 (Google-Docs-like).
 *   • /portal/materials/docs/new  → 새 문서 작성 (tiptap)
 *   • /portal/materials/docs/:id  → 뷰 (뷰어/편집자/작성자) + 편집 전환(canEdit)
 * 공유대상(포털 사용자 전체)별 뷰어/편집자 권한은 작성자만 변경.
 * 본문 HTML 은 렌더 시 DOMPurify sanitize.
 */

interface ShareDraft {
  kind: 'STUDENT' | 'TEACHER';
  refId: string;
  name: string;
  role: MaterialShareRole;
}

const btnCls =
  'rounded p-1.5 text-secondary hover:bg-[var(--gray-100)] hover:text-primary disabled:opacity-40';
const activeBtnCls = 'bg-accent-600 text-white hover:bg-accent-600 hover:text-white';

export function PortalDocPage() {
  const { docId } = useParams<{ docId: string }>();
  const isNew = !docId;
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const kind = useAuthStore((s) => s.portal.user?.kind);
  const canAuthor = kind === 'TEACHER' || kind === 'STUDENT';

  const [editing, setEditing] = useState(isNew);
  const [title, setTitle] = useState('');
  const [shares, setShares] = useState<ShareDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: doc, isLoading } = useQuery({
    enabled: !isNew,
    queryKey: ['portal-doc', docId],
    queryFn: () => portalApi.getDoc(docId!),
  });

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editable: editing,
    editorProps: {
      attributes: {
        class:
          'doc-prose max-w-none min-h-[240px] rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary focus:outline-none',
      },
    },
  });

  // 문서 로드 시 편집 상태 동기화.
  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setShares(
        doc.shareTargets.map((s) => ({
          kind: s.kind,
          refId: s.refId,
          name: s.name,
          role: s.role,
        })),
      );
      editor?.commands.setContent(doc.content || '<p></p>');
    }
  }, [doc, editor]);

  useEffect(() => {
    editor?.setEditable(editing);
  }, [editing, editor]);

  const createMut = useMutation({
    mutationFn: () =>
      portalApi.createDoc(
        title,
        editor?.getHTML() ?? '',
        shares.map(toShareInput),
      ),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['portal-materials'] });
      navigate(`/portal/materials/docs/${created.id}`, { replace: true });
    },
    onError: (e) => setError(errMsg(e)),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      await portalApi.updateDoc(docId!, {
        title,
        content: editor?.getHTML() ?? '',
      });
      // 공유변경은 작성자만 — 서버가 403 으로 걸러주지만 불필요 호출 방지.
      if (doc?.mine) {
        await portalApi.updateDocShares(docId!, shares.map(toShareInput));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-doc', docId] });
      qc.invalidateQueries({ queryKey: ['portal-materials'] });
      setEditing(false);
      setError(null);
    },
    onError: (e) => setError(errMsg(e)),
  });

  const delMut = useMutation({
    mutationFn: () => portalApi.deleteMaterial(docId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-materials'] });
      navigate('/portal/materials');
    },
  });

  const sanitized = useMemo(
    () => (doc?.content ? DOMPurify.sanitize(doc.content) : ''),
    [doc?.content],
  );

  if (!canAuthor && isNew) {
    return (
      <p className="py-6 text-sm text-secondary">
        {t('portalApp.docs.noPermission', '문서를 작성할 권한이 없습니다.')}
      </p>
    );
  }
  if (!isNew && isLoading) {
    return <p className="py-6 text-center text-sm text-secondary">…</p>;
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <Link
        to="/portal/materials"
        className="mb-3 inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
      >
        <ChevronLeft size={12} /> {t('portalApp.docs.back', '문서/자료실로')}
      </Link>

      {editing ? (
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('portalApp.docs.titlePlaceholder', '문서 제목')}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-base font-medium"
          />

          {editor && <Toolbar editor={editor} />}
          <EditorContent editor={editor} />

          {/* 공유 관리 — 작성자(또는 신규 작성)만 */}
          {(isNew || doc?.mine) && (
            <SharePanel shares={shares} onChange={setShares} />
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (isNew) navigate('/portal/materials');
                else {
                  setEditing(false);
                  editor?.commands.setContent(doc?.content || '<p></p>');
                  setTitle(doc?.title ?? '');
                }
              }}
              className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-secondary"
            >
              {t('actions.cancel', '취소')}
            </button>
            <button
              type="button"
              disabled={!title.trim() || saving}
              onClick={() => (isNew ? createMut.mutate() : updateMut.mutate())}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {t('actions.save', '저장')}
            </button>
          </div>
        </div>
      ) : (
        doc && (
          <article className="rounded-md border border-[var(--border-subtle)] p-5">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-lg font-semibold text-primary">{doc.title}</h1>
              <div className="flex shrink-0 gap-1">
                {doc.canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-xs text-accent-700 hover:bg-[var(--gray-50)]"
                  >
                    <Pencil size={12} /> {t('actions.edit', '편집')}
                  </button>
                )}
                {doc.mine && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          t('portalApp.materials.confirmDelete', '이 게시물을 삭제할까요?'),
                        )
                      )
                        delMut.mutate();
                    }}
                    className="rounded border border-[var(--border-subtle)] p-1 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-1 text-xs text-secondary">
              {doc.authorName &&
                `${t('portalApp.materials.author', '작성자')}: ${doc.authorName} · `}
              {new Date(doc.createdAt).toLocaleDateString()}
            </div>
            {doc.shareTargets.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {doc.shareTargets.map((s) => (
                  <span
                    key={`${s.kind}:${s.refId}`}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-secondary"
                  >
                    {s.name}
                    <span
                      className={`rounded px-1 text-[9px] font-medium ${
                        s.role === 'EDITOR'
                          ? 'bg-accent-50 text-accent-700'
                          : 'bg-[var(--gray-100)] text-secondary'
                      }`}
                    >
                      {s.role === 'EDITOR'
                        ? t('portalApp.docs.editor', '편집자')
                        : t('portalApp.docs.viewer', '뷰어')}
                    </span>
                  </span>
                ))}
              </div>
            )}

            <div
              className="doc-prose mt-4 max-w-none text-sm text-primary"
              // 저장된 HTML 은 DOMPurify.sanitize 를 거친다 (XSS 방지).
              dangerouslySetInnerHTML={{ __html: sanitized }}
            />

            {/* PLN-260719 B+ — 저장 단위 수정 히스토리 / 버전보기 / 복원 */}
            <RevisionHistory docId={doc.id} canEdit={doc.canEdit} />

            <div className="mt-5 border-t border-[var(--border-subtle)] pt-3">
              <div className="mb-1 text-xs font-medium text-secondary">
                {t('portalApp.materials.comments', '댓글')} ({doc.commentCount})
              </div>
              <CommentThread matId={doc.id} />
            </div>
          </article>
        )
      )}
    </div>
  );
}

function toShareInput(s: ShareDraft): DocShareInput {
  return { kind: s.kind, refId: s.refId, role: s.role };
}

// ── 수정 히스토리 (저장 단위 리비전) ─────────────────────────────────────
function RevisionHistory({ docId, canEdit }: { docId: string; canEdit: boolean }) {
  const { t, i18n } = useTranslation('common');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewSeq, setViewSeq] = useState<number | null>(null);

  const { data: revisions = [] } = useQuery({
    enabled: open,
    queryKey: ['portal-doc-revisions', docId],
    queryFn: () => portalApi.docRevisions(docId),
  });

  const { data: snapshot } = useQuery({
    enabled: viewSeq !== null,
    queryKey: ['portal-doc-revision', docId, viewSeq],
    queryFn: () => portalApi.docRevision(docId, viewSeq!),
  });

  const restoreMut = useMutation({
    mutationFn: (seq: number) => portalApi.restoreDocRevision(docId, seq),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-doc', docId] });
      qc.invalidateQueries({ queryKey: ['portal-doc-revisions', docId] });
      setViewSeq(null);
    },
  });

  const latestSeq = revisions[0]?.seq ?? null;
  const snapshotHtml = useMemo(
    () => (snapshot?.content ? DOMPurify.sanitize(snapshot.content) : ''),
    [snapshot?.content],
  );

  const fmtDT = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));

  return (
    <div className="mt-5 border-t border-[var(--border-subtle)] pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-accent-700"
      >
        <History size={12} />
        {t('portalApp.docs.history', '수정 히스토리')}
        {open && revisions.length > 0 && ` (${revisions.length})`}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {revisions.length === 0 ? (
            <p className="text-xs text-secondary">
              {t('portalApp.docs.noHistory', '기록이 없습니다.')}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)]">
              {revisions.map((r) => {
                const isLatest = r.seq === latestSeq;
                return (
                  <li key={r.seq} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <span className="w-10 shrink-0 font-mono font-medium text-primary">
                      v{r.seq}
                    </span>
                    {isLatest && (
                      <span className="shrink-0 rounded bg-accent-50 px-1.5 py-0.5 text-[10px] text-accent-700">
                        {t('portalApp.docs.current', '현재')}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-primary">
                      {r.editorName}
                    </span>
                    <span className="shrink-0 text-secondary">{fmtDT(r.createdAt)}</span>
                    {!isLatest && (
                      <button
                        type="button"
                        onClick={() => setViewSeq(viewSeq === r.seq ? null : r.seq)}
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] ${
                          viewSeq === r.seq
                            ? 'border-accent-600 bg-accent-600 text-white'
                            : 'border-[var(--border-subtle)] text-accent-700 hover:bg-[var(--gray-50)]'
                        }`}
                      >
                        {t('portalApp.docs.viewVersion', '보기')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* 선택 버전 스냅샷 */}
          {viewSeq !== null && snapshot && (
            <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-amber-800">
                  v{snapshot.seq} · {snapshot.title} · {snapshot.editorName} ·{' '}
                  {fmtDT(snapshot.createdAt)}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    disabled={restoreMut.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          t(
                            'portalApp.docs.confirmRestore',
                            '이 버전으로 복원할까요? (복원도 새 버전으로 기록됩니다)',
                          ),
                        )
                      )
                        restoreMut.mutate(snapshot.seq);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {restoreMut.isPending ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <RotateCcw size={11} />
                    )}
                    {t('portalApp.docs.restore', '이 버전으로 복원')}
                  </button>
                )}
              </div>
              <div
                className="doc-prose max-w-none rounded bg-white px-3 py-2 text-sm text-primary"
                dangerouslySetInnerHTML={{ __html: snapshotHtml }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? '저장에 실패했습니다.'
  );
}

// ── tiptap 툴바 ─────────────────────────────────────────────────────────
function Toolbar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--gray-50)] px-1.5 py-1">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`${btnCls} ${editor.isActive('bold') ? activeBtnCls : ''}`}
      >
        <Bold size={14} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${btnCls} ${editor.isActive('italic') ? activeBtnCls : ''}`}
      >
        <Italic size={14} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`${btnCls} ${editor.isActive('strike') ? activeBtnCls : ''}`}
      >
        <Strikethrough size={14} />
      </button>
      <span className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />
      {([1, 2] as const).map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          className={`${btnCls} px-2 text-xs font-semibold ${
            editor.isActive('heading', { level }) ? activeBtnCls : ''
          }`}
        >
          H{level}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`${btnCls} ${editor.isActive('bulletList') ? activeBtnCls : ''}`}
      >
        <List size={14} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`${btnCls} ${editor.isActive('orderedList') ? activeBtnCls : ''}`}
      >
        <ListOrdered size={14} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`${btnCls} ${editor.isActive('blockquote') ? activeBtnCls : ''}`}
      >
        <Quote size={14} />
      </button>
      <span className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={btnCls}
      >
        <Undo2 size={14} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={btnCls}
      >
        <Redo2 size={14} />
      </button>
    </div>
  );
}

// ── 공유 관리 패널 (포털 사용자 전체 검색 + 뷰어/편집자 지정) ────────────
function SharePanel({
  shares,
  onChange,
}: {
  shares: ShareDraft[];
  onChange: (next: ShareDraft[]) => void;
}) {
  const { t } = useTranslation('common');
  const [q, setQ] = useState('');

  const { data: candidates = [] } = useQuery({
    queryKey: ['portal-all-users'],
    queryFn: portalApi.allPortalUsers,
  });

  const selectedKeys = new Set(shares.map((s) => `${s.kind}:${s.refId}`));
  const filtered = candidates.filter(
    (c: PortalUserCandidate) =>
      !selectedKeys.has(`${c.kind}:${c.refId}`) &&
      (!q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const add = (c: PortalUserCandidate) =>
    onChange([...shares, { ...c, role: 'VIEWER' }]);
  const remove = (key: string) =>
    onChange(shares.filter((s) => `${s.kind}:${s.refId}` !== key));
  const setRole = (key: string, role: MaterialShareRole) =>
    onChange(
      shares.map((s) => (`${s.kind}:${s.refId}` === key ? { ...s, role } : s)),
    );

  return (
    <div className="space-y-2 rounded-md border border-[var(--border-subtle)] p-3">
      <div className="text-xs font-medium text-secondary">
        {t('portalApp.docs.shareTitle', '공유 대상 (뷰어/편집자)')}
      </div>

      {/* 선택된 대상 + 권한 */}
      {shares.length === 0 ? (
        <p className="text-xs text-secondary">
          {t('portalApp.docs.shareEmpty', '아직 공유 대상이 없습니다. 아래에서 추가하세요.')}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {shares.map((s) => {
            const key = `${s.kind}:${s.refId}`;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--gray-50)] px-2 py-1 text-xs"
              >
                <span
                  className={`rounded px-1 text-[9px] font-mono ${
                    s.kind === 'TEACHER'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {s.kind === 'TEACHER'
                    ? t('portalApp.docs.kindTeacher', '강사')
                    : t('portalApp.docs.kindStudent', '학생')}
                </span>
                {s.name}
                <select
                  value={s.role}
                  onChange={(e) => setRole(key, e.target.value as MaterialShareRole)}
                  className="rounded border border-[var(--border-subtle)] bg-canvas px-1 py-0.5 text-[11px]"
                >
                  <option value="VIEWER">{t('portalApp.docs.viewer', '뷰어')}</option>
                  <option value="EDITOR">{t('portalApp.docs.editor', '편집자')}</option>
                </select>
                <button
                  type="button"
                  onClick={() => remove(key)}
                  className="opacity-60 hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* 후보 검색/추가 */}
      <div className="flex items-center gap-1.5 rounded border border-[var(--border-subtle)] bg-canvas px-2">
        <Search size={12} className="opacity-60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('portalApp.docs.searchUser', '이름 검색 (강사/학생)')}
          className="h-8 w-full bg-transparent text-xs focus:outline-none"
        />
      </div>
      <div className="max-h-36 overflow-y-auto">
        {filtered.slice(0, 30).map((c) => (
          <button
            key={`${c.kind}:${c.refId}`}
            type="button"
            onClick={() => add(c)}
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-[var(--gray-50)]"
          >
            <span
              className={`rounded px-1 text-[9px] font-mono ${
                c.kind === 'TEACHER'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {c.kind === 'TEACHER'
                ? t('portalApp.docs.kindTeacher', '강사')
                : t('portalApp.docs.kindStudent', '학생')}
            </span>
            {c.name}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-1 text-xs text-secondary">
            {t('portalApp.docs.noResult', '결과가 없습니다.')}
          </p>
        )}
      </div>
    </div>
  );
}
