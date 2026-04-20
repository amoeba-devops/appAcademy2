import { create } from 'zustand';

interface AuthState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
