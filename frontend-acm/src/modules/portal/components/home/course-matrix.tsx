import { useTranslation } from 'react-i18next';

const NAVY = '#152448';

/**
 * TPI course catalog matrix — 3 columns × 2 rows below hero.
 * Mirrors live tpi.co.kr above-the-fold course grid:
 *   Col 1 (Core):     [TPI Core Class header]   → NWEA Official MAP TEST, MAP TEST 온라인 튜터링 클래스
 *   Col 2 (ISEE):     (no header)               → ISEE 온라인 튜터링 클래스 (spans both rows)
 *   Col 3 (Advanced): [TPI Advanced Class hdr]  → SSAT/TOEFL/Duolingo, PSAT/AP IB/SAT ACT
 */
export function CourseMatrix() {
  const { t } = useTranslation('portal');
  return (
    <section className="bg-white px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {/* Headers row */}
          <div
            className="rounded-t-md py-3 text-center text-sm font-bold text-white sm:text-base"
            style={{ backgroundColor: NAVY }}
          >
            {t('home.course-matrix.core-header')}
          </div>
          <div aria-hidden="true" />
          <div className="rounded-t-md bg-slate-200 py-3 text-center text-sm font-bold text-slate-700 sm:text-base">
            {t('home.course-matrix.advanced-header')}
          </div>

          {/* Row 1 */}
          <article
            className="flex aspect-square items-center justify-center rounded-md text-center text-sm font-bold leading-snug text-white sm:text-base lg:text-lg"
            style={{ backgroundColor: NAVY }}
          >
            <span>
              {t('home.course-matrix.core-1-line1')}
              <br />
              {t('home.course-matrix.core-1-line2')}
            </span>
          </article>
          <article
            className="row-span-2 flex items-center justify-center rounded-md bg-slate-100 text-center text-base font-bold leading-snug text-slate-800 sm:text-lg lg:text-xl"
            aria-label={t('home.course-matrix.isee-label')}
          >
            <span>
              {t('home.course-matrix.isee-line1')}
              <br />
              {t('home.course-matrix.isee-line2')}
            </span>
          </article>
          <article className="flex aspect-square items-center justify-center rounded-md bg-slate-100 text-center text-sm font-medium leading-relaxed text-slate-700 sm:text-base lg:text-lg">
            <span className="space-y-1">
              <span className="block">{t('home.course-matrix.advanced-1-l1')}</span>
              <span className="block">{t('home.course-matrix.advanced-1-l2')}</span>
              <span className="block">{t('home.course-matrix.advanced-1-l3')}</span>
            </span>
          </article>

          {/* Row 2 */}
          <article
            className="flex aspect-square items-center justify-center rounded-md text-center text-sm font-bold leading-snug text-white sm:text-base lg:text-lg"
            style={{ backgroundColor: NAVY }}
          >
            <span>
              {t('home.course-matrix.core-2-line1')}
              <br />
              {t('home.course-matrix.core-2-line2')}
            </span>
          </article>
          <article className="flex aspect-square items-center justify-center rounded-md bg-slate-100 text-center text-sm font-medium leading-relaxed text-slate-700 sm:text-base lg:text-lg">
            <span className="space-y-1">
              <span className="block">{t('home.course-matrix.advanced-2-l1')}</span>
              <span className="block">{t('home.course-matrix.advanced-2-l2')}</span>
              <span className="block">{t('home.course-matrix.advanced-2-l3')}</span>
            </span>
          </article>
        </div>
      </div>
    </section>
  );
}
