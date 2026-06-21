import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** ACM admin/teacher/staff user — from `/acm/auth/login` or AMA exchange. */
export interface AcmUser {
  id: string;
  entId: string;
  email?: string;
  role?: 'ADMIN' | 'TEACHER' | 'STAFF' | 'APP_ADMIN';
  roles?: string[];
  /** REQ-260621 — true until the user rotates a seeded/admin-set password. */
  mustChangePassword?: boolean;
}

/** Parent user — from `/auth/parent/verify-otp`. */
export interface ParentUser {
  id: number;
  academyId: number;
  name: string;
  phone: string;
  role: 'PARENT';
}

export type AuthRole = 'admin' | 'parent';

interface AuthState {
  // ── Admin slot (legacy field names kept for backward compatibility) ──
  token: string | null;
  user: AcmUser | null;

  // ── Parent slot ─────────────────────────────────────────────────────
  parent: {
    token: string | null;
    user: ParentUser | null;
  };

  // ── Active session marker — set on most recent login ────────────────
  active: AuthRole | null;

  // ── Admin actions (legacy names kept) ───────────────────────────────
  setAuth: (token: string, user: AcmUser) => void;
  clearMustChangePassword: () => void;
  clear: () => void;

  // ── Parent actions ──────────────────────────────────────────────────
  setParentAuth: (token: string, user: ParentUser) => void;
  clearAdmin: () => void;
  clearParent: () => void;
}

const initialParent = { token: null, user: null };

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      parent: initialParent,
      active: null,

      setAuth: (token, user) =>
        set({ token, user, active: 'admin' }),

      clearMustChangePassword: () =>
        set((s) => (s.user ? { user: { ...s.user, mustChangePassword: false } } : {})),

      setParentAuth: (token, user) =>
        set({ parent: { token, user }, active: 'parent' }),

      clearAdmin: () =>
        set((s) => ({
          token: null,
          user: null,
          active: s.active === 'admin' ? (s.parent.token ? 'parent' : null) : s.active,
        })),

      clearParent: () =>
        set((s) => ({
          parent: initialParent,
          active: s.active === 'parent' ? (s.token ? 'admin' : null) : s.active,
        })),

      clear: () =>
        set({ token: null, user: null, parent: initialParent, active: null }),
    }),
    {
      name: 'acm-auth',
      version: 2,
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<AuthState>;
        if (!version || version < 2) {
          return {
            token: p.token ?? null,
            user: p.user ?? null,
            parent: initialParent,
            active: p.token ? 'admin' : null,
          } as Partial<AuthState> as AuthState;
        }
        return p as AuthState;
      },
    },
  ),
);
