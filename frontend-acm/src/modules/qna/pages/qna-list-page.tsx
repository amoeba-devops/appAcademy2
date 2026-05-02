import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';

interface Question {
  id: string;
  subject: string;
  status: string;
  isFaqPromoted: boolean;
  categoryId?: string | null;
  studentId?: string | null;
  createdAt: string;
}

interface Category {
  id: string;
  code: string;
  labelKr: string;
  labelEn?: string | null;
}

export function QnaListPage() {
  const { t, i18n } = useTranslation('qna');
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFaqOnly, setFilterFaqOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<{ type: 'thread' | 'reply'; q: Question } | null>(null);

  const refresh = () => {
    const params = new URLSearchParams();
    if (filterCategory) params.set('categoryId', filterCategory);
    if (filterStatus) params.set('status', filterStatus);
    if (filterFaqOnly) params.set('faqOnly', 'true');
    apiClient.get(`/acm/qna/questions?${params.toString()}`)
      .then((r) => setQuestions(r.data.items ?? r.data ?? []))
      .catch((e) => setError(e.message ?? 'Failed to load'));
  };

  useEffect(() => {
    apiClient.get('/acm/qna/categories').then((r) => setCategories(r.data ?? [])).catch(() => undefined);
  }, []);

  useEffect(refresh, [filterCategory, filterStatus, filterFaqOnly]);

  const categoryLabel = (id?: string | null) => {
    if (!id) return '—';
    const c = categories.find((x) => x.id === id);
    if (!c) return '—';
    return i18n.language.startsWith('en') && c.labelEn ? c.labelEn : c.labelKr;
  };

  const handleAction = async (q: Question, action: 'reply' | 'escalate' | 'thread' | 'use-faq' | 'delete') => {
    setOpenMenu(null);
    if (action === 'thread') return setOpenModal({ type: 'thread', q });
    if (action === 'reply') return setOpenModal({ type: 'reply', q });
    if (action === 'escalate') {
      await apiClient.post(`/acm/qna/questions/${q.id}/escalate`, {}).catch((e) => setError(e.message));
      return refresh();
    }
    if (action === 'use-faq') {
      const r = await apiClient.post(`/acm/qna/questions/${q.id}/use-faq`).catch(() => null);
      if (r?.data?.externalBody) {
        try { await navigator.clipboard.writeText(r.data.externalBody); } catch { /* ignore */ }
      }
      return refresh();
    }
    if (action === 'delete') {
      if (!confirm('Delete?')) return;
      await apiClient.delete(`/acm/qna/questions/${q.id}`).catch((e) => setError(e.message));
      return refresh();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <button className="px-3 py-1.5 rounded-md border border-[var(--border-subtle)] bg-surface hover:bg-[var(--bg-hover)]">
          + {t('newQuestion')}
        </button>
      </div>

      <div className="flex gap-2 items-center mb-4 text-sm">
        <select
          className="border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">{t('filters.category')} — {t('filters.all')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{categoryLabel(c.id)}</option>
          ))}
        </select>
        <select
          className="border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">{t('filters.status')} — {t('filters.all')}</option>
          {['OPEN', 'RESPONDED', 'RESOLVED', 'ESCALATED', 'DEFERRED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={filterFaqOnly} onChange={(e) => setFilterFaqOnly(e.target.checked)} />
          {t('filters.faqOnly')}
        </label>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 mb-4 text-sm">{error}</div>}
      {!questions && !error && <div className="text-secondary">{t('loading')}</div>}
      {questions && questions.length === 0 && (
        <div className="rounded-lg bg-surface border border-[var(--border-subtle)] p-6 text-secondary">{t('empty')}</div>
      )}

      {questions && questions.length > 0 && (
        <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-subtle)] text-left">
              <tr>
                <th className="px-3 py-2">{t('columns.subject')}</th>
                <th className="px-3 py-2">{t('columns.category')}</th>
                <th className="px-3 py-2">{t('columns.status')}</th>
                <th className="px-3 py-2">{t('columns.faq')}</th>
                <th className="px-3 py-2">{t('columns.createdAt')}</th>
                <th className="px-3 py-2">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id} className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2 font-medium">{q.subject}</td>
                  <td className="px-3 py-2">{categoryLabel(q.categoryId)}</td>
                  <td className="px-3 py-2">{q.status}</td>
                  <td className="px-3 py-2">{q.isFaqPromoted ? '★' : ''}</td>
                  <td className="px-3 py-2 text-secondary">{new Date(q.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 relative">
                    <button onClick={() => setOpenMenu(openMenu === q.id ? null : q.id)} className="px-2">⋯</button>
                    {openMenu === q.id && (
                      <div className="absolute right-0 mt-1 bg-surface border border-[var(--border-subtle)] rounded shadow-md z-10 min-w-[180px]">
                        <ActionMenuItem label={t('actions.reply')} onClick={() => handleAction(q, 'reply')} />
                        <ActionMenuItem label={t('actions.escalate')} onClick={() => handleAction(q, 'escalate')} />
                        <ActionMenuItem label={t('actions.viewThread')} onClick={() => handleAction(q, 'thread')} />
                        {q.isFaqPromoted && (
                          <ActionMenuItem label={t('actions.useFaq')} onClick={() => handleAction(q, 'use-faq')} />
                        )}
                        <ActionMenuItem label={t('actions.delete')} onClick={() => handleAction(q, 'delete')} danger />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openModal?.type === 'thread' && (
        <ThreadModal q={openModal.q} onClose={() => setOpenModal(null)} />
      )}
      {openModal?.type === 'reply' && (
        <ReplyModal q={openModal.q} onClose={() => { setOpenModal(null); refresh(); }} />
      )}
    </div>
  );
}

function ActionMenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 hover:bg-[var(--bg-hover)] text-sm ${danger ? 'text-red-600' : ''}`}
    >
      {label}
    </button>
  );
}

function ThreadModal({ q, onClose }: { q: Question; onClose: () => void }) {
  const { t } = useTranslation('qna');
  const [items, setItems] = useState<Question[] | null>(null);
  useEffect(() => {
    apiClient.get(`/acm/qna/questions/${q.id}/thread`).then((r) => setItems(r.data ?? []));
  }, [q.id]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('thread.title')}</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">✕</button>
        </div>
        {!items && <div className="text-secondary">{t('loading')}</div>}
        {items && items.map((item, idx) => (
          <div key={item.id} className={`mb-3 ${idx > 0 ? 'pl-4 border-l-2 border-[var(--border-subtle)]' : ''}`}>
            <div className="text-xs text-secondary">
              [#{idx + 1}] {new Date(item.createdAt).toLocaleString()} — {item.status}
            </div>
            <div className="font-medium">{item.subject}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReplyModal({ q, onClose }: { q: Question; onClose: () => void }) {
  const { t } = useTranslation('qna');
  const [subject, setSubject] = useState(`Re: ${q.subject}`);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSend = async () => {
    setSubmitting(true);
    try {
      await apiClient.post(`/acm/qna/questions/${q.id}/reply`, { subject, body });
      onClose();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-lg max-w-xl w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('reply.title', { subject: q.subject })}</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">✕</button>
        </div>
        <label className="block text-sm mb-1">{t('reply.subject')}</label>
        <input
          className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 mb-3"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <label className="block text-sm mb-1">{t('reply.body')}</label>
        <textarea
          className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 mb-4 h-32"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 border border-[var(--border-subtle)] rounded">
            {t('reply.cancel')}
          </button>
          <button
            onClick={handleSend}
            disabled={submitting || !body}
            className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {t('reply.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
