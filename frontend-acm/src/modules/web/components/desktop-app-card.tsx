import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download,
  ExternalLink,
  Loader2,
  Monitor,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  loadBodaAppApi,
  type BodaLaunchContext,
} from '@/lib/boda-launch-api';

/**
 * REQ-260619 FR-LX-2.2 — 모드 B: 데스크톱 앱 카드 + 브라우저 새 탭 fallback.
 *
 * 사용자에게 두 가지 진입 옵션을 동시에 제공:
 *   1. 데스크톱 앱 (BodaAppApi.bodaOpen/Join) — vendor 권장 경로
 *   2. 브라우저 새 탭 (`webBrowserUrl`) — vendor 의 WebRTC 페이지로 직접 진입
 *
 * iframe 임베드(모드 A)가 거부되거나 env 로 비활성된 경우 본 카드가 기본 화면.
 */
export function DesktopAppCard({
  ctx,
  isTeacher,
}: {
  ctx: BodaLaunchContext;
  isTeacher: boolean;
}) {
  const { t } = useTranslation('classroom');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onEnterDesktop = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const api = await loadBodaAppApi(ctx.appApiUrl);
      const fn = isTeacher ? api.bodaOpen : api.bodaJoin;
      if (!fn) throw new Error('BODA-NOT_INSTALLED');
      const params: Record<string, unknown> = {
        meetKey: ctx.meetKey,
        roomCode: ctx.roomCode,
        UTy: ctx.userType,
        joinUser: { UId: ctx.uid, UNm: ctx.uname },
        joinOpt: { lang: ctx.lang },
      };
      if (isTeacher) params.dup = 1;
      fn(params);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'BODA-ERROR');
    } finally {
      setSubmitting(false);
    }
  };

  const onOpenInBrowser = () => {
    if (!ctx.webBrowserUrl) return;
    window.open(ctx.webBrowserUrl, '_blank', 'noopener,noreferrer');
  };

  const browserDisabled = !ctx.webBrowserUrl;

  return (
    <div className="w-full max-w-2xl mx-auto p-6 border-2 border-dashed border-[var(--border-subtle)] rounded-lg bg-[var(--canvas-subtle)]">
      <div className="flex flex-col items-center gap-4 text-center">
        <Monitor size={36} className="text-accent-600" aria-hidden />
        <div>
          <h2 className="text-base font-semibold text-primary">
            {t('embed.desktopTitle')}
          </h2>
          <p className="mt-1 text-xs text-secondary max-w-md">
            {t('embed.desktopHint')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center w-full">
          <Button
            size="lg"
            onClick={onEnterDesktop}
            disabled={submitting}
            className="min-w-[12rem]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Video size={16} className="mr-2" aria-hidden />
            )}
            {isTeacher ? t('enterTeacher') : t('enterStudent')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onOpenInBrowser}
            disabled={browserDisabled}
            title={browserDisabled ? t('embed.openInBrowserUnavailable') : undefined}
            className="min-w-[12rem]"
          >
            <ExternalLink size={16} className="mr-2" aria-hidden />
            {t('embed.openInBrowser')}
          </Button>
        </div>

        {error && (
          <p className="text-xs text-red-600 mt-1">
            {t(`error.${error}.title`, {
              defaultValue: t('error.unknown.title'),
            })}
          </p>
        )}

        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.open('https://bodaedu.kr', '_blank', 'noopener,noreferrer');
          }}
          className="inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
        >
          <Download size={12} />
          {t('embed.installGuide')}
        </a>
      </div>
    </div>
  );
}
