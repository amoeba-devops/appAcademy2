import { useMemo, useState } from 'react';
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
  bodaInstallUndetectable,
  detectBodaPlatform,
  enterBodaRoom,
  loadBodaAppApi,
  logBodaError,
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

  // FR-4 — Mac/Mobile can't self-detect app install (SPEC §1.3), so the browser
  // entry is promoted to equal prominence there.
  const platform = useMemo(() => detectBodaPlatform(), []);
  const emphasizeBrowser = bodaInstallUndetectable(platform);

  const onEnterDesktop = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const api = await loadBodaAppApi(ctx.appApiUrl);
      // bodaOpen/Join report install/launch failures asynchronously via the
      // error callback rather than throwing (823.001.4) — surface + log those
      // (FR-3: capture the SPEC 2nd `reason` arg too, incl. WB-* WAS codes).
      api.setErrorCallback?.((code, reason) => {
        const c = code || 'BODA-ERROR';
        logBodaError(c, reason);
        setError(c);
      });
      const launched = enterBodaRoom(api, ctx, { isTeacher });
      if (!launched) throw new Error('BODA-NOT_INSTALLED');
    } catch (e) {
      const code = e instanceof Error ? e.message : 'BODA-ERROR';
      logBodaError(code);
      setError(code);
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

        <div
          className={`flex flex-wrap gap-2 justify-center w-full${
            emphasizeBrowser ? ' flex-col-reverse sm:flex-row-reverse' : ''
          }`}
        >
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
            variant={emphasizeBrowser ? 'default' : 'outline'}
            onClick={onOpenInBrowser}
            disabled={browserDisabled}
            title={browserDisabled ? t('embed.openInBrowserUnavailable') : undefined}
            className="min-w-[12rem]"
          >
            <ExternalLink size={16} className="mr-2" aria-hidden />
            {t('embed.openInBrowser')}
          </Button>
        </div>

        {emphasizeBrowser && (
          <p className="text-xs text-secondary max-w-md">
            {t('embed.macMobileHint')}
          </p>
        )}

        {error && (
          <div className="text-xs text-red-600 mt-1 space-y-0.5">
            <p className="font-semibold">
              {t(`error.${error}.title`, {
                defaultValue: t('error.unknown.title'),
              })}
            </p>
            <p className="text-red-500">
              {t(`error.${error}.body`, {
                defaultValue: t('error.unknown.body'),
              })}
            </p>
            <p className="text-[10px] text-secondary">({error})</p>
          </div>
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
