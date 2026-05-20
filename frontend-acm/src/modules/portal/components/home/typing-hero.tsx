import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TPI_HERO_BG } from '@/modules/portal/content/tpi-content';

const CHAR_INTERVAL_MS = 60;
const LINE_DELAY_MS = 350;

/**
 * Typing-animation hero. Replaces v1 `HeroSection`.
 * Mirrors reference (tpi-index.mhtml `.typing-hero` + `.typing-hero-m`).
 * Line 1: "No. 1 [MAP TEST]" — highlight word colored.
 * Line 2: "온라인 튜터링 전문기관"
 * Animation runs once per mount. Strict-mode safe via mountedRef.
 */
export function TypingHero() {
  const { t } = useTranslation('portal');
  const prefix = t('home.typing-hero.line1-prefix');
  const highlight = t('home.typing-hero.line1-highlight');
  const line2Full = t('home.typing-hero.line2');

  const [shown1, setShown1] = useState('');
  const [shownH, setShownH] = useState('');
  const [shown2, setShown2] = useState('');
  const [doneAll, setDoneAll] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return; // strict-mode dedupe
    mountedRef.current = true;
    let cancelled = false;
    let timers: number[] = [];

    const typeText = (
      full: string,
      apply: (s: string) => void,
    ): Promise<void> =>
      new Promise((resolve) => {
        let i = 0;
        const tick = () => {
          if (cancelled) return resolve();
          if (i > full.length) return resolve();
          apply(full.slice(0, i));
          i += 1;
          timers.push(window.setTimeout(tick, CHAR_INTERVAL_MS));
        };
        tick();
      });

    const wait = (ms: number) =>
      new Promise<void>((r) => timers.push(window.setTimeout(() => r(), ms)));

    (async () => {
      await typeText(prefix, setShown1);
      await wait(120);
      await typeText(highlight, setShownH);
      await wait(LINE_DELAY_MS);
      await typeText(line2Full, setShown2);
      if (!cancelled) setDoneAll(true);
    })();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [prefix, highlight, line2Full]);

  const caret = doneAll ? null : (
    <span className="inline-block w-[2px] h-[1em] bg-blue-300 align-middle ml-1 animate-pulse" />
  );

  return (
    <section className="relative isolate overflow-hidden bg-slate-900 text-white">
      <div className="absolute inset-0 -z-10">
        <img
          src={TPI_HERO_BG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-blue-900/85 via-slate-900/80 to-slate-900/95"
        />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <h1
          aria-label={`${prefix}${highlight} ${line2Full}`}
          className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
        >
          <span>{shown1}</span>
          <span className="text-blue-300">{shownH}</span>
          {shown1 && !shown2 && caret}
          <br />
          <span>{shown2}</span>
          {shown2 && caret}
        </h1>

        <p className="mx-auto mt-8 max-w-md text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
          {t('home.typing-hero.brand-label')}
        </p>

        <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-white/85 sm:text-lg">
          {t('home.typing-hero.subtitle')}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            to="/web/contact"
            className="inline-flex items-center justify-center rounded-full bg-blue-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-colors hover:bg-blue-400 sm:text-base"
          >
            {t('home.typing-hero.cta-consult')}
          </Link>
          <Link
            to="/web/test"
            className="inline-flex items-center justify-center rounded-full border border-white/70 bg-white/10 px-7 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white hover:text-slate-900 sm:text-base"
          >
            {t('home.typing-hero.cta-test')}
          </Link>
        </div>
      </div>
    </section>
  );
}
