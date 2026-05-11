import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, UserPlus, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  useParents,
  useLinkParentToStudent,
  type LinkParentInput,
} from '../hooks/use-parents';

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const labelClass = 'block text-xs text-secondary mb-1';

const RELATION_OPTIONS = [
  { value: 'FATHER', label: '아버지' },
  { value: 'MOTHER', label: '어머니' },
  { value: 'GUARDIAN', label: '보호자' },
  { value: 'OTHER', label: '기타' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  stdId: string;
}

/**
 * REQ-260511 — Parent picker:
 *  - "Search existing" mode: debounced search → list → click [+] to link
 *  - "Create new" mode: minimal form → POST creates+links
 */
export function ParentPickOrCreateDialog({ open, onClose, stdId }: Props) {
  const { t } = useTranslation('std');
  const [mode, setMode] = useState<'search' | 'create'>('search');

  // search state
  const [rawQ, setRawQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(rawQ.trim()), 300);
    return () => clearTimeout(id);
  }, [rawQ]);

  const enableSearch = debouncedQ.length >= 2;
  const { data: list, isFetching } = useParents(
    enableSearch ? { q: debouncedQ, limit: 20 } : { limit: 20 },
  );

  // create state
  const [form, setForm] = useState<LinkParentInput>({
    parName: '',
    parRelation: '',
    parPhone: '',
    parEmail: '',
    spIsPrimary: false,
  });

  const [setPrimaryOnLink, setSetPrimaryOnLink] = useState(false);

  const linkMut = useLinkParentToStudent(stdId);

  // reset on open
  useEffect(() => {
    if (open) {
      setMode('search');
      setRawQ('');
      setDebouncedQ('');
      setSetPrimaryOnLink(false);
      setForm({ parName: '', parRelation: '', parPhone: '', parEmail: '', spIsPrimary: false });
    }
  }, [open]);

  const items = useMemo(() => list?.items ?? [], [list]);

  const handleLinkExisting = async (parId: string) => {
    await linkMut.mutateAsync({ parId, spIsPrimary: setPrimaryOnLink });
    onClose();
  };

  const handleCreateAndLink = async () => {
    if (!form.parName?.trim()) return;
    await linkMut.mutateAsync({
      parName: form.parName.trim(),
      parRelation: form.parRelation || undefined,
      parPhone: form.parPhone || undefined,
      parEmail: form.parEmail || undefined,
      spIsPrimary: !!form.spIsPrimary,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('parentPicker.title', '학부모 추가')}</DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-2 border-b border-[var(--border-subtle)] pb-2">
          <Button
            variant={mode === 'search' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('search')}
          >
            <Users className="h-4 w-4 mr-1" />
            {t('parentPicker.modeSearch', '기존 학부모 선택')}
          </Button>
          <Button
            variant={mode === 'create' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('create')}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            {t('parentPicker.modeCreate', '신규 학부모 등록')}
          </Button>
        </div>

        {mode === 'search' ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
              <input
                autoFocus
                value={rawQ}
                onChange={(e) => setRawQ(e.target.value)}
                placeholder={t('parentPicker.searchPlaceholder', '이름, 전화번호 또는 이메일 (2자 이상)')}
                className={inputClass + ' pl-8'}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-secondary">
              <input
                type="checkbox"
                checked={setPrimaryOnLink}
                onChange={(e) => setSetPrimaryOnLink(e.target.checked)}
              />
              {t('parentPicker.linkAsPrimary', '대표 학부모로 지정')}
            </label>

            <div className="max-h-72 overflow-y-auto rounded-md border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
              {isFetching && (
                <p className="p-3 text-xs text-secondary">{t('common:status.loading')}</p>
              )}
              {!isFetching && items.length === 0 && (
                <p className="p-3 text-xs text-secondary">
                  {enableSearch
                    ? t('parentPicker.noResults', '검색 결과가 없습니다')
                    : t('parentPicker.startTyping', '검색어를 2자 이상 입력하세요')}
                </p>
              )}
              {items.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-2 text-sm hover:bg-[var(--canvas-subtle)]"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-primary truncate">
                      {p.name}
                      {p.relation && (
                        <span className="ml-2 text-xs text-secondary">({p.relation})</span>
                      )}
                      {typeof p.childCount === 'number' && p.childCount > 0 && (
                        <span className="ml-2 text-xs text-accent">
                          {t('parentPicker.linkedChildren', '연결 자녀 {{count}}명', { count: p.childCount })}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-secondary truncate">
                      {p.phone ?? '—'} · {p.email ?? '—'}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleLinkExisting(p.id)}
                    disabled={linkMut.isPending}
                  >
                    {t('parentPicker.linkBtn', '연결')}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('field.parentName', '이름')} *</label>
                <input
                  autoFocus
                  value={form.parName ?? ''}
                  onChange={(e) => setForm({ ...form, parName: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('field.parentRelation', '관계')}</label>
                <select
                  value={form.parRelation ?? ''}
                  onChange={(e) => setForm({ ...form, parRelation: e.target.value })}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {RELATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('field.parentPhone', '전화번호')}</label>
                <input
                  value={form.parPhone ?? ''}
                  onChange={(e) => setForm({ ...form, parPhone: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('field.parentEmail', '이메일')}</label>
                <input
                  type="email"
                  value={form.parEmail ?? ''}
                  onChange={(e) => setForm({ ...form, parEmail: e.target.value })}
                  className={inputClass}
                />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-xs text-secondary">
                <input
                  type="checkbox"
                  checked={!!form.spIsPrimary}
                  onChange={(e) => setForm({ ...form, spIsPrimary: e.target.checked })}
                />
                {t('field.parentPrimary', '대표 학부모')}
              </label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={linkMut.isPending}>
            {t('common:actions.cancel', '취소')}
          </Button>
          {mode === 'create' && (
            <Button
              onClick={handleCreateAndLink}
              disabled={!form.parName?.trim() || linkMut.isPending}
            >
              {t('parentPicker.createAndLink', '등록 및 연결')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
