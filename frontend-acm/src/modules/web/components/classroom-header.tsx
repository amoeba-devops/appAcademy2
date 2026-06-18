import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, GraduationCap, User2, Users, Zap } from 'lucide-react';
import type {
  BodaInviteeView,
  BodaLaunchContext,
  BodaRoomStatus,
} from '@/lib/boda-launch-api';
import { AttendeesModal } from './attendees-modal';

/**
 * REQ-260619 FR-LX-1 — 런처 페이지 헤더.
 *
 * 3 줄 구성:
 *   1. 강의 제목 + ⚡ INSTANT 칩
 *   2. 강사 이름 + 시간 + 룸 상태 뱃지
 *   3. 수강생 칩 그리드 (최대 7명 + `+N` 모달)
 *
 * 학생/학부모 화면(`userType === 12`)은 백엔드에서 `invitees: []` 로 강제
 * 마스킹되어 들어오므로 본 컴포넌트는 그 조건만 체크해 3 번째 줄을 hide.
 */

const STATUS_BADGE: Record<BodaRoomStatus, { label: string; cls: string }> = {
  PENDING: { label: '대기', cls: 'bg-gray-100 text-gray-700 border-gray-300' },
  OPEN: { label: '개설됨', cls: 'bg-green-100 text-green-800 border-green-300' },
  STARTED: { label: '진행 중', cls: 'bg-green-100 text-green-800 border-green-300' },
  PAUSED: { label: '일시정지', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  ENDED: { label: '종료', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  CLOSED: { label: '폐쇄됨', cls: 'bg-red-50 text-red-700 border-red-200' },
};

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export function ClassroomHeader({
  ctx,
  status,
}: {
  ctx: BodaLaunchContext;
  status: BodaRoomStatus | undefined;
}) {
  const { t } = useTranslation('classroom');
  const [showAll, setShowAll] = useState(false);

  const invitees: BodaInviteeView[] = ctx.invitees ?? [];
  const hasAttendees = invitees.length > 0;
  const visible = invitees.slice(0, 7);
  const overflow = Math.max(0, invitees.length - visible.length);

  const badge = STATUS_BADGE[status ?? ctx.status] ?? STATUS_BADGE.PENDING;

  return (
    <header className="w-full max-w-2xl mx-auto px-4 py-3 border-b border-[var(--border-subtle)]">
      {/* Line 1 — title + INSTANT badge */}
      <h1 className="text-base sm:text-lg font-semibold text-primary flex items-center gap-2 flex-wrap">
        <GraduationCap size={18} className="text-accent-600 shrink-0" aria-hidden />
        <span className="truncate">{ctx.evtTitle}</span>
        {ctx.evtSource === 'INSTANT' && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-100 text-amber-800 border border-amber-300">
            <Zap size={10} /> {t('header.instantBadge')}
          </span>
        )}
      </h1>

      {/* Line 2 — teacher · time · room status */}
      <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs text-secondary">
        <span className="inline-flex items-center gap-1">
          <User2 size={12} aria-hidden />
          {t('header.teacher', { name: ctx.ownerName })}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={12} aria-hidden />
          {fmtTime(ctx.evtStartAt)} ~ {fmtTime(ctx.evtEndAt)}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${badge.cls}`}
        >
          {t(`boda.statusValue.${status ?? ctx.status}`, {
            ns: 'cal',
            defaultValue: badge.label,
          })}
        </span>
      </div>

      {/* Line 3 — attendees (teacher/admin view only — students see []) */}
      {hasAttendees && (
        <div className="mt-2 flex items-start gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs text-secondary shrink-0">
            <Users size={12} aria-hidden />
            {t('header.attendees', { count: invitees.length })}
          </span>
          <div className="flex flex-wrap gap-1">
            {visible.map((i) => (
              <span
                key={`${i.kind}:${i.refId}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--canvas-subtle)] border border-[var(--border-subtle)] text-[11px]"
                title={i.subLabel ? `${i.name} · ${i.subLabel}` : i.name}
              >
                {i.kind === 'TEACHER' && (
                  <span className="text-purple-600 font-medium">T</span>
                )}
                {i.kind === 'PARENT' && (
                  <span className="text-amber-600 font-medium">P</span>
                )}
                <span className="text-primary">{i.name}</span>
                {i.subLabel && (
                  <span className="text-[10px] text-secondary">· {i.subLabel}</span>
                )}
              </span>
            ))}
            {overflow > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="inline-flex items-center px-1.5 py-0.5 rounded border border-accent-300 bg-accent-50 text-accent-700 text-[11px] hover:bg-accent-100"
              >
                {t('header.attendeesMoreBtn', { more: overflow })}
              </button>
            )}
          </div>
        </div>
      )}

      <AttendeesModal
        open={showAll}
        onClose={() => setShowAll(false)}
        invitees={invitees}
      />
    </header>
  );
}
