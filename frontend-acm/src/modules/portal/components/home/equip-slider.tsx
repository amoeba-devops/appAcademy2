import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const AUTOPLAY_MS = 5000;

/**
 * 10-image facility / equipment slider.
 * Replaces v1 `ReviewsSlider` (8 images, different CDN).
 * Mirrors reference (tpi-index.mhtml `#equip-slider-section`).
 */
const IMAGES: ReadonlyArray<string> = [
  'https://i.ifh.cc/CKXn3z.png',
  'https://i.ifh.cc/XqogrM.png',
  'https://i.ifh.cc/VHvBZN.png',
  'https://i.ifh.cc/gvrj56.png',
  'https://i.ifh.cc/7jb3kr.png',
  'https://i.ifh.cc/Lzxa8A.png',
  'https://i.ifh.cc/w5Kc9B.png',
  'https://i.ifh.cc/Lb4OdL.png',
  'https://i.ifh.cc/noxm0B.png',
  'https://i.ifh.cc/FwgX9R.png',
];

export function EquipSlider() {
  const { t } = useTranslation('portal');
  const total = IMAGES.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || total <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, total]);

  const go = (delta: number) => setIndex((i) => (i + delta + total) % total);

  return (
    <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-xl font-semibold text-slate-900 sm:text-2xl">
          {t('home.equip-slider.title')}
        </h2>
        <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-blue-500" aria-hidden="true" />

        <div
          className="relative mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="relative aspect-[16/9] w-full">
            {IMAGES.map((src, i) => (
              <div
                key={src}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  i === index ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden={i !== index}
              >
                <img
                  src={src}
                  alt={`Equip ${i + 1}`}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            aria-label={t('home.equip-slider.prev')}
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur transition-colors hover:bg-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={t('home.equip-slider.next')}
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur transition-colors hover:bg-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="mt-5 flex justify-center gap-2">
          {IMAGES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-blue-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
