import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { ChevronLeft, Download, LogIn, Pencil } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useCalEvent } from '../hooks/use-cal-events';
import { CalEventModal, teacherJoinUrl } from '../components/cal-event-modal';
import { formatTime } from '../lib/date-utils';

/**
 * PLN-260729-2 — 관리자 수업일정 상세 "페이지" (/admin/cal/:evtId).
 * 일/주/리스트 뷰에서 모달 없이 바로 진입. [수정] 은 기존 편집 모달 재사용.
 */

interface ClassRecordRow {
  kind: string;
  name: string | null;
  joinedAt: string;
  leftAt: string | null;
  totalSeconds: number | null;
}

export function CalEventDetailPage() {
  const { evtId } = useParams<{ evtId: string }>();
  const { t, i18n } = useTranslation(['cal', 'common']);
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: event, isLoading } = useCalEvent(evtId);

  const { data: record } = useQuery({
    enabled: !!evtId,
    queryKey: ['cal', 'class-record', evtId],
    queryFn: async () =>
      (
        await apiClient.get<{
          openedAt: string | null;
          startedAt: string | null;
          endedAt: string | null;
          closedAt: string | null;
          participants: ClassRecordRow[];
        } | null>(`/acm/cal/events/${evtId}/class-record`)
      ).data,
  });

  const { data: review } = useQuery({
    enabled: !!evtId,
    queryKey: ['cal', 'review', evtId],
    queryFn: async () =>
      (
        await apiClient.get<{
          feedbackHtml: string | null;
          homeworkStatus: 'ASSIGNED' | 'NONE' | null;
          homeworkHtml: string | null;
        }>(`/acm/cal/events/${evtId}/review`)
      ).data,
  });

  const fmtFull = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  const fmtShort = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(i18n.language, {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(iso))
      : '—';

  const sanitizedFeedback = useMemo(
    () => (review?.feedbackHtml ? DOMPurify.sanitize(review.feedbackHtml) : ''),
    [review?.feedbackHtml],
  );
  const sanitizedHomework = useMemo(
    () => (review?.homeworkHtml ? DOMPurify.sanitize(review.homeworkHtml) : ''),
    [review?.homeworkHtml],
  );

  if (isLoading || !event) {
    return <p className="py-10 text-center text-sm text-secondary">…</p>;
  }

  const classDone =
    !!review?.feedbackHtml?.trim() && review?.homeworkStatus != null;
  const canEnter = event.meetingProvider === 'BODASCHOOL' && !!event.meetingUrl;

  const downloadAttachment = async (attId: string, filename: string) => {
    const res = await apiClient.get<Blob>(
      `/acm/cal/events/${event.id}/attachments/${attId}/download`,
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl">
      <Link
        to="/admin/cal"
        className="mb-3 inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
      >
        <ChevronLeft size={12} /> {t('detail.backToCal', '수업일정으로')}
      </Link>

      <article className="rounded-md border border-[var(--border-subtle)] bg-surface p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-primary">{event.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[var(--gray-100)] px-2 py-0.5 text-xs text-secondary">
                {t(`category.${event.category}`, event.category)}
              </span>
              {classDone && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                  ✓ {t('review.doneFull', '수업완료')}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {canEnter && (
              <Button
                size="sm"
                onClick={() =>
                  window.open(
                    teacherJoinUrl(event.meetingUrl as string),
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                <LogIn size={14} className="mr-1" />
                {t('actions.enterLink', '입장링크')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil size={14} className="mr-1" />
              {t('common:actions.edit', '수정')}
            </Button>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-secondary">{t('field.startAt', '시작')}</dt>
            <dd>{fmtFull(event.startAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-secondary">{t('field.endAt', '종료')}</dt>
            <dd>{fmtFull(event.endAt)}</dd>
          </div>
          {event.ownerName && (
            <div>
              <dt className="text-xs text-secondary">{t('field.creator', '작성자')}</dt>
              <dd>{event.ownerName}</dd>
            </div>
          )}
          {event.assigneeName && (
            <div>
              <dt className="text-xs text-secondary">{t('field.assignee', '담당 강사')}</dt>
              <dd>{event.assigneeName}</dd>
            </div>
          )}
          {event.locationText && (
            <div>
              <dt className="text-xs text-secondary">{t('field.locationText', '장소')}</dt>
              <dd>{event.locationText}</dd>
            </div>
          )}
        </dl>

        {event.description && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-secondary">{t('field.description', '설명')}</div>
            <div className="whitespace-pre-wrap rounded-md bg-[var(--canvas-subtle)] px-3 py-2 text-sm">
              {event.description}
            </div>
          </div>
        )}

        {(event.invitees ?? []).length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-secondary">
              {t('form.sectionAttendees', '참석자')} ({event.invitees!.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {event.invitees!.map((inv) => (
                <span
                  key={`${inv.kind}:${inv.refId}`}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs"
                >
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] font-mono ${
                      inv.kind === 'STUDENT'
                        ? 'bg-blue-100 text-blue-700'
                        : inv.kind === 'TEACHER'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {inv.kind[0]}
                  </span>
                  {inv.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {(event.attachments ?? []).length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-secondary">{t('attach.section', '첨부자료')}</div>
            <ul className="grid gap-1">
              {event.attachments!.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{a.filename}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => void downloadAttachment(a.id, a.filename)}
                  >
                    <Download size={12} className="mr-1" />
                    {t('attach.download', '다운로드')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 강의실 기록 */}
        {record && (record.openedAt || record.participants.length > 0) && (
          <div className="mt-4 rounded-md border border-[var(--border-subtle)] p-3">
            <div className="mb-1 text-xs font-semibold text-secondary">
              🕐 {t('boda.recordTitle', '강의실 기록')}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <span>
                <span className="text-xs text-secondary">{t('boda.openedAt', '개설')}</span>{' '}
                {fmtShort(record.openedAt)}
              </span>
              <span>
                <span className="text-xs text-secondary">{t('boda.startedAt', '시작')}</span>{' '}
                {fmtShort(record.startedAt)}
              </span>
              <span>
                <span className="text-xs text-secondary">{t('boda.endedAt', '종료')}</span>{' '}
                {fmtShort(record.endedAt)}
              </span>
              <span>
                <span className="text-xs text-secondary">{t('boda.closedAt', '폐쇄')}</span>{' '}
                {fmtShort(record.closedAt)}
              </span>
            </div>
            {record.participants.length > 0 && (
              <ul className="mt-2 space-y-0.5 border-t border-[var(--border-subtle)] pt-2 text-xs">
                {record.participants.map((p, i) => (
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
                      {t(`boda.kind.${p.kind}`, p.kind)}
                    </span>
                    <span className="font-medium">{p.name ?? '-'}</span>
                    <span className="text-secondary">
                      {formatTime(p.joinedAt, i18n.language)} →{' '}
                      {p.leftAt ? formatTime(p.leftAt, i18n.language) : t('boda.stillIn', '접속 중')}
                      {p.totalSeconds != null && ` (${Math.round(p.totalSeconds / 60)}분)`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 피드백·과제 (강사 작성, 관리자 확인용) */}
        {review && (review.feedbackHtml || review.homeworkStatus != null) && (
          <div className="mt-4 space-y-2">
            {review.feedbackHtml && (
              <div className="rounded-md border border-[var(--border-subtle)] p-3">
                <div className="mb-1 text-xs font-semibold text-secondary">
                  📝 {t('review.feedbackLabel', '피드백')}
                </div>
                <div
                  className="doc-prose max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: sanitizedFeedback }}
                />
              </div>
            )}
            {review.homeworkStatus === 'NONE' ? (
              <div className="rounded-md border border-[var(--border-subtle)] p-3 text-sm text-secondary">
                📚 {t('review.noHomework', '과제 없음')}
              </div>
            ) : review.homeworkStatus === 'ASSIGNED' && review.homeworkHtml ? (
              <div className="rounded-md border border-[var(--border-subtle)] p-3">
                <div className="mb-1 text-xs font-semibold text-secondary">
                  📚 {t('review.homeworkLabel', '과제')}
                </div>
                <div
                  className="doc-prose max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: sanitizedHomework }}
                />
              </div>
            ) : null}
          </div>
        )}
      </article>

      <CalEventModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          navigate(0); // 편집 후 상세 최신화
        }}
        initial={event}
      />
    </div>
  );
}
