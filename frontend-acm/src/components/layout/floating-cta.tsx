import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TPI_SITE } from '@/modules/portal/content/tpi-content';

export function FloatingCta() {
  const { t } = useTranslation('portal');
  const BUTTONS = [
    {
      href: '/web/test' as const,
      icon: '📝',
      label: t('floating.map-test'),
      variant: 'primary' as const,
      external: false,
    },
    {
      href: '/web/contact' as const,
      icon: '💬',
      label: t('floating.consult'),
      variant: 'default' as const,
      external: false,
    },
    {
      href: TPI_SITE.kakaoChat,
      icon: '💛',
      label: t('floating.kakao'),
      variant: 'kakao' as const,
      external: true,
    },
    {
      href: `tel:${TPI_SITE.phoneDigits}`,
      icon: '📞',
      label: t('floating.phone'),
      variant: 'default' as const,
      external: false,
    },
  ];

  return (
    <div
      className="fixed right-3 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-2 sm:right-4"
      aria-label={t('floating.aria-label')}
    >
      {BUTTONS.map((btn) => {
        const base =
          'flex h-16 w-16 flex-col items-center justify-center rounded-xl border text-[11px] font-semibold shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl sm:h-[72px] sm:w-[72px]';
        const variant =
          btn.variant === 'primary'
            ? 'bg-blue-600 border-blue-600 text-white'
            : btn.variant === 'kakao'
              ? 'bg-[#FAE100] border-[#FAE100] text-[#3C1E1E]'
              : 'bg-white border-slate-200 text-slate-900';
        const className = `${base} ${variant}`;
        return btn.external ? (
          <a
            key={btn.label}
            href={btn.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={btn.label}
            className={className}
          >
            <span className="mb-1 text-xl sm:text-2xl" aria-hidden="true">
              {btn.icon}
            </span>
            {btn.label}
          </a>
        ) : (
          <Link key={btn.label} to={btn.href} aria-label={btn.label} className={className}>
            <span className="mb-1 text-xl sm:text-2xl" aria-hidden="true">
              {btn.icon}
            </span>
            {btn.label}
          </Link>
        );
      })}
    </div>
  );
}
