import { useEffect, useState } from 'react';

/**
 * PLN-260914 — matchMedia 구독 훅.
 *
 * Tailwind 기본 브레이크포인트와 같은 값을 쓴다 (md 768 / lg 1024).
 * 초기값을 즉시 평가해 첫 렌더에서 레이아웃이 튀지 않게 한다.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** < 768px — 사이드바를 오프캔버스 드로어로 띄우는 구간. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

/** ≥ 1024px — 사용자가 펼침/아이콘을 직접 토글할 수 있는 구간. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
