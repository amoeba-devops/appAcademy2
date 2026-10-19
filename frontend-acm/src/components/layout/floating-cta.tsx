import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TPI_SITE } from '@/modules/portal/content/tpi-content';

export function FloatingCta() {
  // TST-261019 — 휴대폰 하단 바가 있는 동안 외부 채팅 위젯(닫힌 상태)을 바 위로 올린다(globals.css).
  useEffect(() => {
    document.body.classList.add('has-mobile-cta');
    return () => document.body.classList.remove('has-mobile-cta');
  }, []);
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
    // TST-261019 M5 — 휴대폰(<md)은 하단 고정 1줄 바(안전영역 여백 포함), md 이상은 기존 오른쪽 세로 버튼.
    <div
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 gap-1.5 border-t border-slate-200 bg-white/95 px-2 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:inset-x-auto md:bottom-auto md:right-4 md:top-1/2 md:flex md:-translate-y-1/2 md:flex-col md:gap-2 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
      aria-label={t('floating.aria-label')}
    >
      {BUTTONS.map((btn) => {
        const base =
          'flex h-12 min-w-0 flex-col items-center justify-center rounded-lg border text-[11px] font-semibold leading-tight shadow-sm transition-all md:h-[72px] md:w-[72px] md:rounded-xl md:shadow-lg md:hover:-translate-y-0.5 md:hover:shadow-xl';
        const variant =
          btn.variant === 'primary'
            ? 'bg-accent-600 border-blue-600 text-white'
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
            <span className="text-base md:mb-1 md:text-2xl" aria-hidden="true">
              {btn.icon}
            </span>
            <span className="max-w-full truncate px-0.5">{btn.label}</span>
          </a>
        ) : (
          <Link key={btn.label} to={btn.href} aria-label={btn.label} className={className}>
            <span className="text-base md:mb-1 md:text-2xl" aria-hidden="true">
              {btn.icon}
            </span>
            <span className="max-w-full truncate px-0.5">{btn.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
