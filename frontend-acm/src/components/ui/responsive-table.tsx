import { cn } from '@/lib/utils';

/**
 * PLN-260914 — 표를 가로 스크롤 컨테이너로 감싼다.
 *
 * 모바일에서 넓은 표가 본문을 밀어내면 페이지 전체(body)가 가로로 스크롤되어
 * 레이아웃이 깨진다. 표는 **자기 영역 안에서만** 스크롤되어야 한다.
 *
 * `-webkit-overflow-scrolling` 은 iOS 관성 스크롤, `overscroll-x-contain` 은
 * 표 끝에서 페이지가 함께 튀는 것을 막는다.
 */
export function ResponsiveTable({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('w-full overflow-x-auto overscroll-x-contain', className)}>
      {children}
    </div>
  );
}
