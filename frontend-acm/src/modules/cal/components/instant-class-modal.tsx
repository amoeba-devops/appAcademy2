import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Sparkles, Zap } from 'lucide-react';
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
import { useInviteeCandidates } from '../hooks/use-cal-events';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useDemoSeedBodaConfig } from '@/lib/boda-demo-api';

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
  // PLN-260729 1.3 — 담당강사 지정(개설 권한). 미지정 시 등록자(운영자)만 개설 가능.
  const [assigneeTchId, setAssigneeTchId] = useState('');
  const { data: instTeachers = [] } = useQuery({
    queryKey: ['acm', 'teachers'],
    queryFn: async () => {
      const res = await apiClient.get<
        Array<{ id: string; name: string; email?: string }> | { items: Array<{ id: string; name: string; email?: string }> }
      >('/acm/tch/teachers', { params: { status: 'ACTIVE', limit: 200 } });
      const body = res.data;
      return Array.isArray(body) ? body : (body?.items ?? []);
    },
    staleTime: 60_000,
  });
  const [selectedRefIds, setSelectedRefIds] = useState<Set<string>>(new Set());
  // PLN-260729-2 — /admin/std 학생 검색으로 추천 그리드 밖의 학생도 초대.
  const [studentQuery, setStudentQuery] = useState('');
  const [pickedNames, setPickedNames] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const suggestions = useInviteeSuggestions({ enabled: open, limit: 12 });
  const createMut = useCreateInstantEvent();
  const demoSeedMut = useDemoSeedBodaConfig();
  const seededRef = useRef(false);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDuration(90);
    setSelectedRefIds(new Set());
    setStudentQuery('');
    setPickedNames(new Map());
    setError(null);
  }, [open]);

  const items: InviteeSuggestion[] = suggestions.data ?? [];
  const searchQ = studentQuery.trim();
  const candidates = useInviteeCandidates(searchQ, 'STUDENT', open && searchQ.length >= 1);
  const suggestionIds = useMemo(
    () => new Set(items.map((s) => s.refId)),
    [items],
  );
  // 추천 그리드에 없는 선택 학생 → 칩으로 표시.
  const pickedChips = Array.from(selectedRefIds)
    .filter((id) => !suggestionIds.has(id))
    .map((id) => ({ refId: id, name: pickedNames.get(id) ?? id }));

  const toggleStudent = (refId: string) => {
    setSelectedRefIds((prev) => {
      const next = new Set(prev);
      if (next.has(refId)) next.delete(refId);
      else next.add(refId);
      return next;
    });
  };

  // Propagate `?demo=1` from the current page (e.g. /admin/cal?demo=1) to the
  // launcher URL so the entire flow stays in demo mode.
  const demoFromUrl =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('demo') === '1';

  // In demo mode, auto-seed the tenant's BODA config on first modal open so
  // createPending() doesn't 422 for absence of company/room codes. Idempotent
  // server-side — only seeds the secret BYTEA columns once.
  useEffect(() => {
    if (!open || !demoFromUrl || seededRef.current) return;
    seededRef.current = true;
    void demoSeedMut.mutateAsync().catch(() => {
      seededRef.current = false; // allow retry on next open
    });
  }, [open, demoFromUrl, demoSeedMut]);

  const onStart = async () => {
    setError(null);
    try {
      const result = await createMut.mutateAsync({
        assigneeTchId: assigneeTchId || undefined,
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
      const url = demoFromUrl
        ? `${result.launcherUrl}${result.launcherUrl.includes('?') ? '&' : '?'}demo=1`
        : result.launcherUrl;
      window.open(url, '_blank', 'noopener,noreferrer');
      onClose();
    } catch (e) {
      // Backend error shape is { success:false, error:{ code, message } }.
      const err = (
        e as {
          response?: { data?: { error?: { code?: string; message?: string } } };
        }
      )?.response?.data?.error;
      // Prefer a localized, actionable message for known business codes
      // (e.g. BODA config gaps) → fall back to the raw backend message → generic.
      const localized = err?.code
        ? t(`instant.errors.${err.code}`, { defaultValue: '' })
        : '';
      setError(localized || err?.message || t('common:status.error'));
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
            {demoFromUrl && (
              <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                <Sparkles size={10} /> DEMO
              </span>
            )}
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

          {/* PLN-260729 1.3 — 담당강사 지정 (개설 권한) */}
          <div>
            <label className="block text-xs text-secondary mb-1">
              {t('instant.assigneeLabel', '담당강사 (개설 권한)')}
            </label>
            <select
              value={assigneeTchId}
              onChange={(e) => setAssigneeTchId(e.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-2 text-sm"
            >
              <option value="">{t('instant.assigneeNone', '- 미지정 (등록자가 개설) -')}</option>
              {instTeachers.map((tch) => (
                <option key={tch.id} value={tch.id}>
                  {tch.name}
                  {tch.email ? ` (${tch.email})` : ''}
                </option>
              ))}
            </select>
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
            {/* PLN-260729-2 — 학생 검색 (/admin/std 학생 대상) */}
            <div className="relative mt-2">
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary"
              />
              <input
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder={t('instant.searchPlaceholder', '학생 이름/이메일 검색')}
                className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-canvas pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/40"
                disabled={isPending}
              />
            </div>
            {searchQ.length >= 1 && (
              <div className="mt-1 max-h-36 overflow-y-auto rounded-md border border-[var(--border-subtle)]">
                {candidates.isLoading ? (
                  <p className="px-3 py-2 text-xs text-secondary">
                    {t('common:status.loading')}
                  </p>
                ) : (candidates.data ?? []).length === 0 ? (
                  <p className="px-3 py-2 text-xs text-secondary">
                    {t('instant.searchNoResult', '검색 결과가 없습니다.')}
                  </p>
                ) : (
                  (candidates.data ?? []).map((c) => {
                    const checked = selectedRefIds.has(c.refId);
                    return (
                      <button
                        key={c.refId}
                        type="button"
                        onClick={() => {
                          setPickedNames((prev) => new Map(prev).set(c.refId, c.name));
                          toggleStudent(c.refId);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-[var(--canvas-subtle)] ${
                          checked ? 'bg-accent-50' : ''
                        }`}
                      >
                        <span className="text-primary">
                          {c.name}
                          {c.email && (
                            <span className="ml-1.5 text-[10px] text-secondary">{c.email}</span>
                          )}
                        </span>
                        <span className="text-[10px] text-accent-600">
                          {checked ? t('instant.searchRemove', '해제') : t('instant.searchAdd', '추가')}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
            {pickedChips.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {pickedChips.map((c) => (
                  <button
                    key={c.refId}
                    type="button"
                    onClick={() => toggleStudent(c.refId)}
                    title={t('instant.searchRemove', '해제')}
                    className="inline-flex items-center gap-1 rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-[11px] text-accent-700 hover:bg-accent-100"
                  >
                    {c.name} ×
                  </button>
                ))}
              </div>
            )}
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
