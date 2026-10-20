import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * TST-261019 M7 — 가로 스크롤 목록(탭·메뉴) 보조 훅.
 *
 * - `hasMore`: 오른쪽에 더 볼 항목이 남아 있으면 true (오른쪽 흐림 표시용).
 * - `activeKey` 가 바뀌면(마운트 포함) 선택 항목
 *   (`[aria-selected="true"]` 또는 `[aria-current="page"]`)을 가로로만 보이게 스크롤한다.
 *   세로 스크롤은 건드리지 않는다.
 */
export function useScrollHint<T extends HTMLElement>(activeKey: unknown) {
  const ref = useRef<T>(null);
  const [hasMore, setHasMore] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setHasMore(el.scrollWidth - el.scrollLeft - el.clientWidth > 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [update]);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) {
      update();
      return;
    }
    const active = el.querySelector<HTMLElement>('[aria-selected="true"], [aria-current="page"]');
    if (active) {
      const box = el.getBoundingClientRect();
      const item = active.getBoundingClientRect();
      const gap = 16;
      if (item.left < box.left) {
        el.scrollLeft += item.left - box.left - gap;
      } else if (item.right > box.right) {
        el.scrollLeft += item.right - box.right + gap;
      }
    }
    update();
  }, [activeKey, update]);

  return { ref, hasMore };
}
