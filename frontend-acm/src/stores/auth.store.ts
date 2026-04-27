import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AcmUser {
  id: string;
  entId: string;
  email?: string;
  roles?: string[];
}

interface AuthState {
  token: string | null;
  user: AcmUser | null;
  setAuth: (token: string, user: AcmUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: 'acm-auth' },
  ),
);
