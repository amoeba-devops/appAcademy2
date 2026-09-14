import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * PLN-260914 — 콘솔 UI 환경설정 (사용자 브라우저에만 저장).
 *
 * `sidebarCollapsed` 는 **데스크톱(≥1024px) 에서만** 의미가 있다. 태블릿은
 * 항상 아이콘 모드, 모바일은 드로어라 이 값과 무관하게 동작한다.
 */
interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false, // 기본은 펼침 — 기존 사용자 경험 유지
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    { name: 'acm-ui' },
  ),
);
