import { useEffect, useRef } from 'react';

/** Keep the composer inside the visible viewport, including a software keyboard. */
export function useChatViewport(mobile: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !mobile) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bottom = (viewport?.height ?? window.innerHeight) + (viewport?.offsetTop ?? 0);
        const height = Math.max(0, bottom - element.getBoundingClientRect().top - 8);
        element.style.setProperty('--chat-visible-height', `${height}px`);
      });
    };
    measure();
    window.addEventListener('resize', measure);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    const observer = new ResizeObserver(measure);
    if (element.parentElement) observer.observe(element.parentElement);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
      observer.disconnect();
      element.style.removeProperty('--chat-visible-height');
    };
  }, [mobile]);
  return ref;
}
