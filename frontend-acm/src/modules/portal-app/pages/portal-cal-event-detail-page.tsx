import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import {
  BookOpen,
  Check,
  ChevronLeft,
  Copy,
  Loader2,
  Paperclip,
  PenLine,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { DesktopAppCard } from '@/modules/web/components/desktop-app-card';
import { MiniRichEditor } from '../components/mini-rich-editor';
import { portalApi, type PortalCalAttachment } from '../api/portal-api';

/**
 * PLN-260715 — full-content event page for portal (student/parent). Reached
 * from the calendar modal's "전체내용보기". For BODA classes, renders the
 * app/RTC entry card (DesktopAppCard) + a copyable classroom link.
 */
export function PortalCalEventDetailPage() {
  // PLN-260719 R2 — 강사/학생 모두 일정의 모든 정보 노출 (cal 네임스페이스 병용).
  const { t, i18n } = useTranslation(['common', 'cal']);
  const { evtId } = useParams<{ evtId: string }>();

  const { data: event, isLoading } = useQuery({
    enabled: !!evtId,
    queryKey: ['portal-cal-event', evtId],
    queryFn: () => portalApi.calEvent(evtId!),
  });

  const isBoda = event?.meetingProvider === 'BODASCHOOL';
  const fmtFull = (iso: string, withTime: boolean) =>
    new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(new Date(iso));
  const when = event ? fmtFull(event.startAt, !event.allDay) : '';
  const sameDay =
    event &&
    new Date(event.startAt).toDateString() === new Date(event.endAt).toDateString();
  const endLabel = event
    ? event.allDay
      ? sameDay
        ? ''
        : fmtFull(event.endAt, false)
      : sameDay
        ? new Date(event.endAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        : fmtFull(event.endAt, true)
    : '';
  const KIND_BADGE: Record<string, string> = {
    STUDENT: 'bg-blue-100 text-blue-700',
    TEACHER: 'bg-purple-100 text-purple-700',
    PARENT: 'bg-amber-100 text-amber-700',
  };

  return (
    <div>
      <Link
        to="/portal/calendar"
        className="mb-3 inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
      >
        <ChevronLeft size={12} /> {t('portalApp.cal.back', '일정으로')}
      </Link>

      {isLoading || !event ? (
        <p className="py-6 text-center text-sm text-secondary">…</p>
      ) : (
        <article className="rounded-md border border-[var(--border-subtle)] p-5">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-lg font-semibold text-primary">{event.title}</h1>
            <span className="shrink-0 rounded-full bg-[var(--gray-100)] px-2 py-0.5 text-xs text-secondary">
              {t(`cal:category.${event.category}`, event.category)}
            </span>
          </div>
          <div className="mt-2 grid gap-1 text-sm">
            <div>
              <span className="text-secondary">{t('portalApp.cal.when', '일시')}</span>{' '}
              {when}
              {event.allDay && ` (${t('cal:field.allDay', '종일')})`}
              {endLabel && ` ~ ${endLabel}`}
            </div>
            {event.ownerName && (
              <div>
                <span className="text-secondary">{t('portalApp.cal.owner', '작성자')}</span>{' '}
                {event.ownerName}
              </div>
            )}
            {event.assigneeName && (
              <div>
                <span className="text-secondary">{t('portalApp.cal.teacher', '담당 강사')}</span>{' '}
                {event.assigneeName}
              </div>
            )}
            {event.locationText && (
              <div>
                <span className="text-secondary">{t('portalApp.cal.location', '장소')}</span>{' '}
                {event.locationText}
              </div>
            )}
            {event.invitees && event.invitees.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-secondary">{t('portalApp.cal.attendees', '관련자')}</span>{' '}
                {event.invitees.map((i, idx) => (
                  <span
                    key={`${i.kind}-${i.name}-${idx}`}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-xs"
                  >
                    <span
                      className={`rounded px-1 py-0.5 text-[9px] font-medium ${KIND_BADGE[i.kind] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {t(`cal:invitee.kind${i.kind.charAt(0)}${i.kind.slice(1).toLowerCase()}`, i.kind)}
                    </span>
                    {i.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {event.description && (
            <div className="mt-4">
              <div className="mb-1 text-xs text-secondary">
                {t('portalApp.cal.memo', '메모')}
              </div>
              <div className="whitespace-pre-wrap rounded-md bg-[var(--gray-50)] px-3 py-2 text-sm text-primary">
                {event.description}
              </div>
            </div>
          )}

          <ClassRecordSection evtId={event.id} isBoda={isBoda} />

          <RecordingsSection evtId={event.id} isBoda={isBoda} />

          <ReviewSection
            evtId={event.id}
            assigneeTchId={event.assigneeTchId ?? null}
            homeworkFiles={(event.attachments ?? []).filter(
              (a) => a.kind === 'HOMEWORK',
            )}
          />

          {event.attachments &&
            event.attachments.filter((a) => (a.kind ?? 'GENERAL') === 'GENERAL')
              .length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs text-secondary">
                {t('portalApp.cal.materials', '첨부자료')}
              </div>
              <ul className="grid gap-1">
                {event.attachments
                  .filter((a) => (a.kind ?? 'GENERAL') === 'GENERAL')
                  .map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{a.filename}</span>
                    <span className="shrink-0 text-[11px] text-secondary">
                      {(Number(a.sizeBytes) / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void portalApi.downloadCalAttachment(event.id, a.id, a.filename)
                      }
                      className="shrink-0 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-accent-700 hover:bg-[var(--gray-100)]"
                    >
                      {t('portalApp.cal.download', '다운로드')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isBoda ? (
            <div className="mt-5">
              <BodaEntry evtId={event.id} />
            </div>
          ) : (
            event.meetingUrl && (
              <a
                href={event.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 text-sm text-accent-700 hover:underline"
              >
                {t('portalApp.cal.openLink', '수업 링크 열기')}
              </a>
            )
          )}
        </article>
      )}
    </div>
  );
}

// PLN-260728F C — 종료된 보다 강의 녹화본 다운로드.
function RecordingsSection({ evtId, isBoda }: { evtId: string; isBoda: boolean }) {
  const { t } = useTranslation('common');
  const [downloading, setDownloading] = useState<number | null>(null);
  const { data: recs = [] } = useQuery({
    enabled: isBoda,
    queryKey: ['portal-recordings', evtId],
    queryFn: () => portalApi.recordings(evtId),
  });
  const files = recs.filter((r) => r.fileExist);
  if (!isBoda || files.length === 0) return null;

  const fmtDT = (v: string | null) =>
    v && v.length >= 12
      ? `${v.slice(4, 6)}/${v.slice(6, 8)} ${v.slice(8, 10)}:${v.slice(10, 12)}`
      : '';

  return (
    <div className="mt-4">
      <div className="mb-1 text-xs text-secondary">
        🎬 {t('portalApp.recordings.title', '수업 녹화본')}
      </div>
      <ul className="grid gap-1">
        {files.map((r) => (
          <li
            key={r.recordIdx}
            className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate">
              {r.recordTitle || `${t('portalApp.recordings.file', '녹화')} #${r.recordIdx}`}
            </span>
            <span className="shrink-0 text-[11px] text-secondary">
              {fmtDT(r.startDatetime)}
              {r.endDatetime ? ` ~ ${fmtDT(r.endDatetime)}` : ''}
            </span>
            <button
              type="button"
              disabled={downloading === r.recordIdx}
              onClick={async () => {
                setDownloading(r.recordIdx);
                try {
                  await portalApi.downloadRecording(evtId, r.recordIdx);
                } finally {
                  setDownloading(null);
                }
              }}
              className="shrink-0 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-accent-700 hover:bg-[var(--gray-100)] disabled:opacity-50"
            >
              {downloading === r.recordIdx ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                t('portalApp.cal.download', '다운로드')
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// PLN-260728F B — 수업 피드백·과제 섹션 (담당강사=작성, 그 외=열람).
function ReviewSection({
  evtId,
  assigneeTchId,
  homeworkFiles,
}: {
  evtId: string;
  assigneeTchId: string | null;
  homeworkFiles: PortalCalAttachment[];
}) {
  const { t } = useTranslation('common');
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.portal.user);
  const canWrite =
    user?.kind === 'TEACHER' && !!assigneeTchId && user.refId === assigneeTchId;

  const { data: review } = useQuery({
    queryKey: ['portal-cal-review', evtId],
    queryFn: () => portalApi.calReview(evtId),
  });

  const [editingFeedback, setEditingFeedback] = useState(false);
  const [editingHomework, setEditingHomework] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [homeworkDraft, setHomeworkDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (review) {
      setFeedbackDraft(review.feedbackHtml ?? '');
      setHomeworkDraft(review.homeworkHtml ?? '');
    }
  }, [review]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['portal-cal-review', evtId] });
    qc.invalidateQueries({ queryKey: ['portal-cal-event', evtId] });
    qc.invalidateQueries({ queryKey: ['portal-cal-events'] });
  };

  const saveMut = useMutation({
    mutationFn: (patch: {
      feedbackHtml?: string;
      homeworkStatus?: 'ASSIGNED' | 'NONE';
      homeworkHtml?: string;
    }) => portalApi.saveCalReview(evtId, patch),
    onSuccess: () => {
      invalidate();
      setEditingFeedback(false);
      setEditingHomework(false);
      setError(null);
    },
    onError: (e) =>
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t('status.error', '오류가 발생했습니다.'),
      ),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => portalApi.uploadHomeworkFile(evtId, file),
    onSuccess: invalidate,
  });
  const delFileMut = useMutation({
    mutationFn: (attId: string) => portalApi.deleteHomeworkFile(evtId, attId),
    onSuccess: invalidate,
  });

  const sanitizedFeedback = useMemo(
    () => (review?.feedbackHtml ? DOMPurify.sanitize(review.feedbackHtml) : ''),
    [review?.feedbackHtml],
  );
  const sanitizedHomework = useMemo(
    () => (review?.homeworkHtml ? DOMPurify.sanitize(review.homeworkHtml) : ''),
    [review?.homeworkHtml],
  );

  const classDone =
    !!review?.feedbackHtml?.trim() && review?.homeworkStatus != null;

  if (!review && !canWrite) return null;

  return (
    <div className="mt-4 space-y-3">
      {classDone && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          ✓ {t('portalApp.review.done', '수업완료')}
        </span>
      )}

      {/* ── 피드백 ── */}
      <div className="rounded-md border border-[var(--border-subtle)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            <PenLine size={14} />
            {t('portalApp.review.feedback', '수업 피드백')}
            {canWrite && (
              <span className="text-[10px] font-normal text-secondary">
                ({t('portalApp.review.forAdmin', '관리자 확인용')})
              </span>
            )}
          </span>
          {canWrite && !editingFeedback && (
            <button
              type="button"
              onClick={() => setEditingFeedback(true)}
              className="rounded border border-[var(--border-subtle)] px-2 py-1 text-xs text-accent-700 hover:bg-[var(--gray-50)]"
            >
              {review?.feedbackHtml
                ? t('portalApp.review.editFeedback', '피드백 수정')
                : t('portalApp.review.writeFeedback', '피드백 작성')}
            </button>
          )}
        </div>
        {editingFeedback ? (
          <div className="space-y-2">
            <MiniRichEditor value={feedbackDraft} onChange={setFeedbackDraft} />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingFeedback(false)}
                className="rounded-md border border-[var(--border-subtle)] px-3 py-1 text-xs text-secondary"
              >
                {t('actions.cancel', '취소')}
              </button>
              <button
                type="button"
                disabled={saveMut.isPending}
                onClick={() => saveMut.mutate({ feedbackHtml: feedbackDraft })}
                className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                {saveMut.isPending && <Loader2 size={12} className="animate-spin" />}
                {t('actions.save', '저장')}
              </button>
            </div>
          </div>
        ) : review?.feedbackHtml ? (
          <div
            className="doc-prose max-w-none text-sm text-primary"
            dangerouslySetInnerHTML={{ __html: sanitizedFeedback }}
          />
        ) : (
          <p className="text-xs text-secondary">
            {t('portalApp.review.noFeedback', '아직 작성된 피드백이 없습니다.')}
          </p>
        )}
      </div>

      {/* ── 과제 ── */}
      <div className="rounded-md border border-[var(--border-subtle)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            <BookOpen size={14} />
            {t('portalApp.review.homework', '과제')}
          </span>
          {canWrite && !editingHomework && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setEditingHomework(true)}
                className="rounded border border-[var(--border-subtle)] px-2 py-1 text-xs text-accent-700 hover:bg-[var(--gray-50)]"
              >
                {review?.homeworkStatus === 'ASSIGNED'
                  ? t('portalApp.review.editHomework', '과제 수정')
                  : t('portalApp.review.assignHomework', '과제 등록')}
              </button>
              {review?.homeworkStatus !== 'NONE' && (
                <button
                  type="button"
                  disabled={saveMut.isPending}
                  onClick={() => saveMut.mutate({ homeworkStatus: 'NONE' })}
                  className="rounded border border-[var(--border-subtle)] px-2 py-1 text-xs text-secondary hover:bg-[var(--gray-50)]"
                >
                  {t('portalApp.review.noHomeworkBtn', '과제 없음')}
                </button>
              )}
            </div>
          )}
        </div>

        {editingHomework ? (
          <div className="space-y-2">
            <MiniRichEditor value={homeworkDraft} onChange={setHomeworkDraft} />
            {/* 과제 파일 */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-dashed border-[var(--border-subtle)] px-2 py-1 text-xs text-secondary hover:border-accent-500">
                <Paperclip size={12} />
                {uploadMut.isPending
                  ? t('status.loading', '업로드 중…')
                  : t('portalApp.review.attachFile', '파일 첨부')}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadMut.mutate(f);
                    e.target.value = '';
                  }}
                />
              </label>
              {homeworkFiles.map((f) => (
                <span
                  key={f.id}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-xs"
                >
                  {f.filename}
                  <button
                    type="button"
                    onClick={() => delFileMut.mutate(f.id)}
                    className="text-secondary hover:text-red-600"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingHomework(false)}
                className="rounded-md border border-[var(--border-subtle)] px-3 py-1 text-xs text-secondary"
              >
                {t('actions.cancel', '취소')}
              </button>
              <button
                type="button"
                disabled={saveMut.isPending}
                onClick={() =>
                  saveMut.mutate({
                    homeworkStatus: 'ASSIGNED',
                    homeworkHtml: homeworkDraft,
                  })
                }
                className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                {saveMut.isPending && <Loader2 size={12} className="animate-spin" />}
                {t('portalApp.review.saveHomework', '과제 저장')}
              </button>
            </div>
          </div>
        ) : review?.homeworkStatus === 'NONE' ? (
          <p className="text-sm text-secondary">
            {t('portalApp.review.noHomework', '과제 없음')}
          </p>
        ) : review?.homeworkStatus === 'ASSIGNED' ? (
          <div className="space-y-2">
            {review.homeworkHtml && (
              <div
                className="doc-prose max-w-none text-sm text-primary"
                dangerouslySetInnerHTML={{ __html: sanitizedHomework }}
              />
            )}
            {homeworkFiles.length > 0 && (
              <ul className="grid gap-1">
                {homeworkFiles.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm"
                  >
                    <Paperclip size={12} className="shrink-0 text-secondary" />
                    <span className="min-w-0 flex-1 truncate">{f.filename}</span>
                    <button
                      type="button"
                      onClick={() =>
                        void portalApi.downloadCalAttachment(evtId, f.id, f.filename)
                      }
                      className="shrink-0 rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-xs text-accent-700 hover:bg-[var(--gray-100)]"
                    >
                      {t('portalApp.cal.download', '다운로드')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-xs text-secondary">
            {t('portalApp.review.noHomeworkYet', '아직 과제 정보가 없습니다.')}
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// PLN-260728F A — 강의실 실적 기록 (개설/시작/종료 + 입·퇴실).
function ClassRecordSection({ evtId, isBoda }: { evtId: string; isBoda: boolean }) {
  const { t, i18n } = useTranslation('common');
  const { data: rec } = useQuery({
    enabled: isBoda,
    queryKey: ['portal-class-record', evtId],
    queryFn: () => portalApi.classRecord(evtId),
  });
  if (!isBoda || !rec || (!rec.openedAt && rec.participants.length === 0)) {
    return null;
  }
  const fmt = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(i18n.language, {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(iso))
      : '—';
  const dur = (sec: number | null) =>
    sec != null ? ` (${Math.round(sec / 60)}${t('portalApp.record.min', '분')})` : '';
  return (
    <div className="mt-4">
      <div className="mb-1 text-xs text-secondary">
        🕐 {t('portalApp.record.title', '강의실 기록')}
      </div>
      <div className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
          <span>
            <span className="text-xs text-secondary">{t('portalApp.record.opened', '개설')}</span>{' '}
            {fmt(rec.openedAt)}
          </span>
          <span>
            <span className="text-xs text-secondary">{t('portalApp.record.started', '수업 시작')}</span>{' '}
            {fmt(rec.startedAt)}
          </span>
          <span>
            <span className="text-xs text-secondary">{t('portalApp.record.ended', '수업 종료')}</span>{' '}
            {fmt(rec.endedAt)}
          </span>
          <span>
            <span className="text-xs text-secondary">{t('portalApp.record.closed', '폐쇄')}</span>{' '}
            {fmt(rec.closedAt)}
          </span>
        </div>
        {rec.participants.length > 0 && (
          <ul className="mt-2 space-y-0.5 border-t border-[var(--border-subtle)] pt-2 text-xs">
            {rec.participants.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                    p.kind === 'TEACHER'
                      ? 'bg-purple-100 text-purple-700'
                      : p.kind === 'STUDENT'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {t(`portalApp.record.kind${p.kind}`, p.kind)}
                </span>
                <span className="font-medium text-primary">{p.name ?? '-'}</span>
                <span className="text-secondary">
                  {t('portalApp.record.join', '입실')} {fmt(p.joinedAt)} →{' '}
                  {t('portalApp.record.leave', '퇴실')} {fmt(p.leftAt)}
                  {dur(p.totalSeconds)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// BODA app/RTC entry + copyable link. Fetches the launch context (scoped),
// then reuses the shared DesktopAppCard (app entry + browser fallback + install).
function BodaEntry({ evtId }: { evtId: string }) {
  const { t, i18n } = useTranslation('common');
  const [copied, setCopied] = useState(false);

  const { data: ctx, isLoading, error } = useQuery({
    queryKey: ['portal-boda', evtId],
    queryFn: () => portalApi.bodaLaunch(evtId, i18n.language.startsWith('ko') ? 'ko' : 'en'),
    retry: false,
    // PLN-260715 — 방이 PENDING(강사 미개설)이면 주기적으로 재조회해 강사가 열면
    // 자동으로 입장 UI로 전환한다.
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' ? 15000 : false,
  });

  if (isLoading) {
    return <p className="text-sm text-secondary">…</p>;
  }
  if (error) {
    const code = (error as { response?: { data?: { code?: string } } }).response?.data?.code;
    const map: Record<string, string> = {
      NOT_AN_ATTENDEE: t('portalApp.cal.notAttendee', '이 수업의 참석자가 아닙니다.'),
      BODA_LAUNCH_OUT_OF_WINDOW: t('portalApp.cal.outOfWindow', '아직 입장 가능한 시간이 아닙니다.'),
      BODA_ROOM_NOT_PROVISIONED: t('portalApp.cal.joinUnavailable', '입장 링크가 아직 준비되지 않았습니다.'),
      BODA_NOT_BODASCHOOL: t('portalApp.cal.joinUnavailable', '입장 링크가 아직 준비되지 않았습니다.'),
    };
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {(code && map[code]) || t('portalApp.cal.joinError', '강의실에 입장할 수 없습니다.')}
      </p>
    );
  }
  if (!ctx) return null;

  // PLN-260715 — 강사(userType 11)는 강의실을 "개설"하므로 상태 게이트를 적용하지
  // 않는다(PENDING 이어도 bodaOpen 으로 연다). 학생(12)은 강사가 방을 연
  // (OPEN/STARTED/PAUSED) 뒤에만 입장 가능 — 그 전엔 meetIdx 가 없어 벤더가 거부.
  const isTeacher = ctx.userType === 11;
  const ready = ctx.status === 'OPEN' || ctx.status === 'STARTED' || ctx.status === 'PAUSED';
  if (ctx.status === 'ENDED' || ctx.status === 'CLOSED') {
    return (
      <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--gray-50)] px-3 py-2 text-sm text-secondary">
        {t('portalApp.cal.ended', '종료된 수업입니다.')}
      </p>
    );
  }
  // PLN-260716 — 벤더 webhook 미연동으로 방 상태가 PENDING 으로 고정될 수 있어,
  // 학생도 앱(meetKey) 조인을 시도할 수 있게 하드 게이트를 제거한다. PENDING 이면
  // 안내만 소프트하게 표시하고 입장 카드는 노출한다.
  const notOpenHint = !isTeacher && !ready;

  // 공유용 링크는 사용자별 webrtc URL(UTy/UId 고정)이 아니라, 앱 진입을 처리하는
  // 런처 URL 이다(수신자별로 서버가 역할을 판별). = "보다스쿨앱 주소".
  const launcherUrl = `${window.location.origin}/portal/classroom/${evtId}`;
  const copy = () => {
    void navigator.clipboard?.writeText(launcherUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-3">
      {notOpenHint && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('portalApp.cal.notOpenYet', '강사가 강의실을 열면 입장할 수 있어요. (수업 시작 전)')}
        </p>
      )}
      <DesktopAppCard ctx={ctx} isTeacher={isTeacher} />
      <div>
        <label className="mb-1 block text-xs text-secondary">
          {t('portalApp.cal.bodaLink', '보다스쿨 강의실 링크')}
        </label>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={launcherUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--gray-50)] px-2 text-xs text-primary"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs text-secondary hover:bg-[var(--gray-100)]"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? t('portalApp.cal.copied', '복사됨') : t('portalApp.cal.copy', '복사')}
          </button>
        </div>
      </div>
    </div>
  );
}
