import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useCreateInstantEvent,
  useInviteeSuggestions,
  type InviteeSuggestion,
} from '../hooks/use-instant-event';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Duration = 30 | 60 | 90 | 120;

/**
 * REQ-260610 — 즉시 강의 개설 모달.
 *
 * 강사·운영자가 캘린더 헤더에서 클릭하면 본 모달이 뜨고:
 *   1. 제목 (선택) + 진행 시간 (30/60/90/120 라디오) 입력
 *   2. 추천 학생 그리드에서 다중 선택 (또는 검색 — TODO: search wiring 추후)
 *   3. "강의 시작" 클릭 → POST /admin/cal/events/instant
 *   4. 응답의 launcherUrl 을 window.open() 새 탭으로 띄움
 *   5. 모달 닫힘
 */
export function InstantClassModal({ open, onClose }: Props) {
  const { t } = useTranslation('cal');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<Duration>(90);
  const [selectedRefIds, setSelectedRefIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const suggestions = useInviteeSuggestions({ enabled: open, limit: 12 });
  const createMut = useCreateInstantEvent();

  // Reset state every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDuration(90);
    setSelectedRefIds(new Set());
    setError(null);
  }, [open]);

  const items: InviteeSuggestion[] = suggestions.data ?? [];

  const toggleStudent = (refId: string) => {
    setSelectedRefIds((prev) => {
      const next = new Set(prev);
      if (next.has(refId)) next.delete(refId);
      else next.add(refId);
      return next;
    });
  };

  const onStart = async () => {
    setError(null);
    try {
      const result = await createMut.mutateAsync({
        title: title.trim() || undefined,
        durationMin: duration,
        invitees: Array.from(selectedRefIds).map((refId) => ({
          kind: 'STUDENT' as const,
          refId,
        })),
      });
      // Open launcher in a new tab so the teacher's current page (calendar)
      // stays put. autoStart=1 already on the URL → launcher will dispatch
      // bodaOpen() automatically (FR-INSTANT-5).
      window.open(result.launcherUrl, '_blank', 'noopener,noreferrer');
      onClose();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('common:status.error'));
    }
  };

  const selectedCount = selectedRefIds.size;
  const isPending = createMut.isPending;

  const placeholderTitle = useMemo(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return t('instant.titlePlaceholder', { time: `${hh}:${mm}` });
  }, [t, open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap size={18} className="text-amber-500" />
            {t('instant.modalTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-secondary mb-1">
              {t('instant.titleLabel')}{' '}
              <span className="text-secondary">({t('common:status.optional', '선택')})</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={placeholderTitle}
              className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/40"
              maxLength={200}
              disabled={isPending}
            />
          </div>

          {/* Duration radio */}
          <div>
            <label className="block text-xs text-secondary mb-1">
              {t('instant.durationLabel')}
            </label>
            <div className="flex gap-3 flex-wrap">
              {([30, 60, 90, 120] as Duration[]).map((d) => (
                <label
                  key={d}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm cursor-pointer ${
                    duration === d
                      ? 'bg-accent-50 border-accent-300 text-accent-700'
                      : 'bg-canvas border-[var(--border-subtle)] text-primary hover:bg-[var(--canvas-subtle)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="instant-duration"
                    className="sr-only"
                    checked={duration === d}
                    onChange={() => setDuration(d)}
                    disabled={isPending}
                  />
                  {t('instant.durationOption', { minutes: d })}
                </label>
              ))}
            </div>
          </div>

          {/* Suggested students */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-secondary">
                {t('instant.inviteLabel')}
              </label>
              <span className="text-[11px] text-secondary">
                {t('instant.selectedCount', { count: selectedCount })}
              </span>
            </div>
            {suggestions.isLoading ? (
              <p className="text-xs text-secondary py-3">{t('common:status.loading')}</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-secondary py-3">{t('instant.emptySuggestions')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-[var(--border-subtle)] rounded-md p-2">
                {items.map((s) => {
                  const checked = selectedRefIds.has(s.refId);
                  return (
                    <label
                      key={s.refId}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer ${
                        checked
                          ? 'bg-accent-50 border border-accent-200'
                          : 'hover:bg-[var(--canvas-subtle)] border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStudent(s.refId)}
                        disabled={isPending}
                      />
                      <span className="flex flex-col leading-tight">
                        <span className="text-primary">{s.name}</span>
                        {s.subLabel && (
                          <span
                            className={`text-[10px] ${
                              s.reason === 'CLASS' ? 'text-accent-600' : 'text-secondary'
                            }`}
                          >
                            {s.reason === 'CLASS'
                              ? s.subLabel
                              : t('instant.recentTag')}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-secondary mt-1.5 flex items-center gap-1">
              <Search size={11} /> {t('instant.searchHint')}
            </p>
          </div>

          {/* Info banner */}
          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-[11px] text-blue-800">
            ℹ️ {t('instant.notifyHint')}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onStart}
            disabled={isPending}
            className="bg-amber-500 hover:bg-amber-600"
          >
            <Zap size={14} className="mr-1" />
            {isPending ? t('common:status.loading') : t('instant.startBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
