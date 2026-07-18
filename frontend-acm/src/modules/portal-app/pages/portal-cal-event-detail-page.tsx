import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Copy, Check } from 'lucide-react';
import { DesktopAppCard } from '@/modules/web/components/desktop-app-card';
import { portalApi } from '../api/portal-api';

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

          {event.attachments && event.attachments.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs text-secondary">
                {t('portalApp.cal.materials', '첨부자료')}
              </div>
              <ul className="grid gap-1">
                {event.attachments.map((a) => (
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
