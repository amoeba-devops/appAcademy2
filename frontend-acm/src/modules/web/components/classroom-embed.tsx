import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BodaLaunchContext, BodaRoomStatus } from '@/lib/boda-launch-api';
import { DemoBodaWindow } from './demo-boda-window';
import { DesktopAppCard } from './desktop-app-card';

/**
 * REQ-260619 FR-LX-2 — 강의실 영역 모드 분기.
 *
 *   demo=1                                → 모드 C (Mock 시뮬레이터)
 *   embedUrl 존재 + iframe load 성공      → 모드 A (vendor iframe)
 *   그 외                                 → 모드 B (DesktopAppCard)
 *
 * 모드 A 에서 iframe `onload` 가 5초 이내 불리지 않으면 자동 모드 B fallback.
 * X-Frame-Options / CSP 거부 시 브라우저는 load 이벤트도 안 부르므로 타이머가
 * 잡는다 (vendor Q-LX-1 회신 전에는 BODA_EMBED_ENABLED=false 라 이 경로
 * 자체가 안 탐).
 */

const IFRAME_LOAD_TIMEOUT_MS = 5000;

export function ClassroomEmbed({
  ctx,
  evtId,
  isTeacher,
  demo,
  roomStatus,
}: {
  ctx: BodaLaunchContext;
  evtId: string;
  isTeacher: boolean;
  demo: boolean;
  roomStatus: BodaRoomStatus | undefined;
}) {
  const { t } = useTranslation('classroom');
  const [iframeFailed, setIframeFailed] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const timerRef = useRef<number | null>(null);

  // ── Mode C ── Demo simulator ─────────────────────────────────────────
  if (demo) {
    return (
      <DemoBodaWindow
        ctx={ctx}
        evtId={evtId}
        isTeacher={isTeacher}
        initialStatus={roomStatus}
      />
    );
  }

  // ── Mode A → B fallback ──────────────────────────────────────────────
  const tryEmbed = !iframeFailed && !!ctx.embedUrl;

  useEffect(() => {
    if (!tryEmbed) return;
    setIframeReady(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (!iframeReady) setIframeFailed(true);
    }, IFRAME_LOAD_TIMEOUT_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.embedUrl, tryEmbed]);

  if (tryEmbed) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden border border-[var(--border-subtle)]">
          <iframe
            title={t('embed.iframeTitle', { defaultValue: 'BODA Classroom' })}
            src={ctx.embedUrl!}
            className="absolute inset-0 w-full h-full"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            allow="camera; microphone; display-capture; autoplay"
            onLoad={() => {
              setIframeReady(true);
              if (timerRef.current) window.clearTimeout(timerRef.current);
            }}
            onError={() => setIframeFailed(true)}
          />
          {!iframeReady && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">
              {t('embed.iframeLoading')}
            </div>
          )}
        </div>
        {/* Always show the "open in browser" tab option as a parallel action */}
        <div className="mt-3 text-center">
          {ctx.webBrowserUrl && (
            <a
              href={ctx.webBrowserUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-700 hover:underline"
            >
              {t('embed.openInBrowser')} ↗
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Mode B ── Desktop app + Open in browser ──────────────────────────
  return (
    <div className="w-full">
      {iframeFailed && ctx.embedUrl && (
        <div className="max-w-2xl mx-auto mb-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] text-center">
          {t('embed.iframeFallbackToast')}
        </div>
      )}
      <DesktopAppCard ctx={ctx} isTeacher={isTeacher} />
    </div>
  );
}
