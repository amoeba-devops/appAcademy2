import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
  useTenantSettings,
  useUpdateTenantSettings,
} from '@/modules/cfg/hooks/use-tenant-settings';

/**
 * /admin/config/general — 테넌트 일반 설정: 타임존 (REQ-260903).
 * 서비스 국가 한국 기본(Asia/Seoul). 수업일정 등 모든 시간 표시·입력 기준.
 */
const TZ_OPTIONS = [
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Singapore',
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
];

function tzLabel(tz: string, locale: string): string {
  try {
    const offset =
      new Intl.DateTimeFormat(locale, {
        timeZone: tz,
        timeZoneName: 'longOffset',
      })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? '';
    return `${tz} (${offset})`;
  } catch {
    return tz;
  }
}

export function GeneralConfigPage() {
  const { t, i18n } = useTranslation('common');
  const toast = useToast();
  const { data, isLoading, isError } = useTenantSettings();
  const update = useUpdateTenantSettings();

  const [timezone, setTimezone] = useState('Asia/Seoul');
  useEffect(() => {
    if (data) setTimezone(data.timezone);
  }, [data]);

  // 선택 TZ 기준 현재 시각 미리보기 (1분 정밀도면 충분)
  const preview = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(i18n.language, {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());
    } catch {
      return '—';
    }
  }, [timezone, i18n.language]);

  const options = useMemo(() => {
    // 저장된 값이 목록 밖(IANA 직접 지정)이어도 표시되게 포함
    const set = timezone && !TZ_OPTIONS.includes(timezone)
      ? [timezone, ...TZ_OPTIONS]
      : TZ_OPTIONS;
    return set.map((z) => ({ value: z, label: tzLabel(z, i18n.language) }));
  }, [timezone, i18n.language]);

  const onSave = async () => {
    try {
      await update.mutateAsync({ timezone });
      toast.success(t('config.saved'));
    } catch {
      toast.error(t('config.errors.saveFailed'));
    }
  };

  return (
    <div className="max-w-2xl">
      <Link
        to="/admin/config"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
      >
        <ArrowLeft size={16} />
        {t('config.backToList')}
      </Link>
      <header className="mb-6 flex items-center gap-2">
        <Globe size={20} className="text-accent-700" />
        <h1 className="text-xl font-semibold text-primary">
          {t('config.general.title')}
        </h1>
      </header>

      <p className="mb-6 text-sm text-secondary">{t('config.general.description')}</p>

      {isLoading ? (
        <p className="text-sm text-secondary">{t('config.loading')}</p>
      ) : isError ? (
        <p className="text-sm text-red-600">{t('config.errors.loadFailed')}</p>
      ) : (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-surface p-6">
          <div className="space-y-1.5">
            <Label htmlFor="tenantTz">{t('config.general.fields.timezone.label')}</Label>
            <select
              id="tenantTz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-secondary">
              {t('config.general.fields.timezone.hint')}
            </p>
          </div>

          <p className="mt-4 text-xs text-secondary">
            {t('config.general.preview', { now: preview })}
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setTimezone(data?.timezone ?? 'Asia/Seoul')}
              disabled={update.isPending}
            >
              {t('actions.cancel')}
            </Button>
            <Button onClick={onSave} disabled={update.isPending}>
              {update.isPending ? t('actions.saving') : t('actions.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
