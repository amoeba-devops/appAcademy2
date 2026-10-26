import { useConfigScope } from '@/modules/cfg/hooks/use-config-access';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface MyMenus {
  /** 숨김 처리된 admin 메뉴 키. */
  hidden: string[];
  /** PLN-260728E — 테넌트 표시 순서(전체 관리 키의 순서 리스트). */
  order: string[];
  /** REQ-261026 — 테넌트 사용자 메뉴(북마크), 등급 필터 적용·표시 순서. */
  custom: {
    id: string;
    name: string;
    url: string;
    newTab: boolean;
    /** REQ-261026B — 위치(북마크 그룹 / 업무관리 그룹 끝)·열기 방식(링크 / 화면 안). */
    group: 'BOOKMARKS' | 'WORK';
    openMode: 'LINK' | 'EMBED';
  }[];
}

/**
 * REQ-260621 v1.1 / PLN-260728E — 호출자 테넌트의 admin 사이드바 메뉴 설정
 * (숨김 + 순서). AppShell 이 사이드바 필터·정렬에 사용(UI-only). Fail-open:
 * 로딩/오류 시 빈 값 → 전체 표시·기본 순서.
 */
export function useMyMenus() {
  const scope = useConfigScope();
  return useQuery({
    queryKey: ['me-menus', ...scope],
    enabled: !!scope[0] && !!scope[1],
    queryFn: async () => {
      const res = await apiClient.get<MyMenus>('/acm/me/menus');
      return {
        hidden: res.data.hidden ?? [],
        order: res.data.order ?? [],
        custom: res.data.custom ?? [],
      } satisfies MyMenus;
    },
    staleTime: 0,
    refetchInterval: 30_000,
  });
}
