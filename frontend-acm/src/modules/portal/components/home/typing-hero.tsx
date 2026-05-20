import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const CHAR_INTERVAL_MS = 60;
const LINE_DELAY_MS = 350;
const NAVY = '#152448';

/**
 * Landing hero. Mirrors live tpi.co.kr — white background, dark navy text.
 *   1) Brand H2 (static, medium) — "NWEA MAP TEST 공식 기관 / 트리니티 프렙 인스티튜트"
 *   2) Typing H1 (animated, heavy bold, large) — "No. 1 MAP TEST / 온라인 튜터링 전문기관"
 *   3) Subtitle paragraph
 * Animation runs once on mount. Strict-mode safe via mountedRef.
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
    if (mountedRef.current) return;
    mountedRef.current = true;
    let cancelled = false;
    const timers: number[] = [];

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
    <span
      className="inline-block w-[2px] h-[0.9em] align-middle ml-1 animate-pulse"
      style={{ backgroundColor: NAVY }}
    />
  );

  return (
    <section className="bg-white text-center" style={{ color: NAVY }}>
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        {/* Brand H2 — static, lighter weight */}
        <p className="text-xl font-normal leading-snug sm:text-2xl lg:text-3xl">
          {t('home.typing-hero.brand-line1')}
        </p>
        <p className="mt-1 text-xl font-normal leading-snug sm:text-2xl lg:text-3xl">
          {t('home.typing-hero.brand-line2')}
        </p>

        {/* Typing H1 — animated, heavy bold, very large */}
        <h1
          aria-label={`${prefix}${highlight} ${line2Full}`}
          className="mt-10 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl"
        >
          <span>{shown1}</span>
          <span>{shownH}</span>
          {shown1 && !shown2 && caret}
          <br />
          <span>{shown2}</span>
          {shown2 && caret}
        </h1>

        <p className="mx-auto mt-8 max-w-3xl text-sm leading-relaxed text-slate-700 sm:text-base">
          {t('home.typing-hero.subtitle')}
        </p>
      </div>
    </section>
  );
}
