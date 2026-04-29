import { useTranslation } from 'react-i18next';
import type { ClassDetail } from '../types';

export function ClsInfoCard({ cls }: { cls: ClassDetail }) {
  const { t } = useTranslation(['cls', 'common']);
  const dash = t('common:dash');

  const fmtMoney = (raw: string | null) => {
    if (!raw) return dash;
    const n = Number(raw);
    if (!Number.isFinite(n)) return raw;
    return t('detail.info.hourlyRateValue', {
      amount: n.toLocaleString('ko-KR'),
    });
  };

  const provider = cls.videoConfig?.provider;
  const videoLine =
    !provider || provider === 'NONE'
      ? t('detail.info.videoNone')
      : `${t(`video.providers.${provider}`)}${
          cls.videoConfig?.persistentLink ? ` · ${cls.videoConfig.persistentLink}` : ''
        }`;

  return (
    <dl className="grid grid-cols-1 gap-4 rounded-lg bg-surface border border-[var(--border-subtle)] p-5 sm:grid-cols-2">
      <Row label={t('detail.info.startedFrom')}>
        {t(`startedFrom.${cls.startedFrom}`)}
      </Row>
      <Row label={t('detail.info.defaultMode')}>
        {t(`session.modes.${cls.defaultMode}`)}
      </Row>
      <Row label={t('detail.info.hourlyRate')}>{fmtMoney(cls.hourlyRateKrw)}</Row>
      <Row label={t('detail.info.video')}>{videoLine}</Row>
    </dl>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-secondary">{label}</dt>
      <dd className="mt-1 text-sm text-primary">{children}</dd>
    </div>
  );
}
