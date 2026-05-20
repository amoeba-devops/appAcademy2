import { useTranslation } from 'react-i18next';
import { TPI_SITE } from '@/modules/portal/content/tpi-content';

export function PortalFooter() {
  const { t } = useTranslation('portal');
  return (
    <footer className="border-t border-slate-200 bg-slate-900 px-4 pb-8 pt-12 text-slate-200 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-6 text-sm md:grid-cols-2">
          <div>
            <p className="text-base font-semibold text-white">{t('footer.company-name')}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
              {t('footer.legal-name')}
            </p>
            <dl className="mt-4 space-y-1.5 text-slate-300">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-400">
                  {t('footer.business-id-label')}
                </dt>
                <dd>{t('footer.business-id')}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-400">
                  {t('footer.address-label')}
                </dt>
                <dd>{t('footer.address')}</dd>
              </div>
            </dl>
          </div>

          <div>
            <ul className="space-y-1.5">
              <li>
                <span className="mr-3 inline-block w-16 text-slate-400">
                  {t('footer.phone-label')}
                </span>
                <a
                  href={`tel:${TPI_SITE.phoneDigits}`}
                  className="text-slate-200 hover:text-white"
                >
                  {t('footer.phone')}
                </a>
              </li>
              <li>
                <span className="mr-3 inline-block w-16 text-slate-400">
                  {t('footer.email-label')}
                </span>
                <a
                  href={`mailto:${TPI_SITE.email}`}
                  className="text-slate-200 hover:text-white"
                >
                  {t('footer.email')}
                </a>
              </li>
              <li>
                <a
                  href={TPI_SITE.kakaoChat}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-yellow-200"
                >
                  💬 {t('footer.kakao-label')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-slate-700 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>{t('footer.copyright')}</p>
          <div className="flex gap-4">
            <a href="#terms" className="hover:text-white">
              {t('footer.terms')}
            </a>
            <a href="#privacy" className="hover:text-white">
              {t('footer.privacy')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
