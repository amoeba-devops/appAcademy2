import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface MoreMenuItem {
  key: string;
  label: ReactNode;
  /** 버튼 동작 */
  onClick?: () => void;
  /** 링크 이동(전체 페이지 이동, 기존 <a href> 와 동일) */
  href?: string;
  disabled?: boolean;
  title?: string;
}

/**
 * UI-261019 — PageHeader 동작 버튼이 주 1 + 보조 2 를 넘을 때 쓰는 "⋯ 더보기" 메뉴.
 * 바깥 클릭·Escape 로 닫힌다.
 */
export function MoreMenu({ label, items }: { label: string; items: MoreMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  const itemCls =
    'block w-full px-3 py-2 text-left text-sm text-primary hover:bg-[var(--gray-50)] disabled:pointer-events-none disabled:opacity-50';

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} className="mr-1" aria-hidden="true" />
        {label}
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute right-0 z-30 mt-1 min-w-[180px] overflow-hidden rounded-md border border-[var(--border-subtle)] bg-surface py-1 shadow-lg"
        >
          {items.map((it) =>
            it.href ? (
              <a
                key={it.key}
                role="menuitem"
                href={it.href}
                title={it.title}
                className={itemCls}
                onClick={() => setOpen(false)}
              >
                {it.label}
              </a>
            ) : (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                title={it.title}
                className={itemCls}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
              >
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
