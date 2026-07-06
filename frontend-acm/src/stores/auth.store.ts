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
  id: string;
  entId: string;
  name: string;
  phone: string | null;
  role: 'PARENT';
}

/** PLN-260706 — unified portal user (student/parent/teacher) from `/portal/auth/login`. */
export interface PortalSession {
  id: string; // pac_id
  entId: string;
  kind: 'STUDENT' | 'PARENT' | 'TEACHER';
  refId: string;
  loginId: string;
  mustChangePassword: boolean;
}

export type AuthRole = 'admin' | 'parent' | 'portal';

interface AuthState {
  // ── Admin slot (legacy field names kept for backward compatibility) ──
  token: string | null;
  user: AcmUser | null;

  // ── Parent slot (legacy OTP portal) ─────────────────────────────────
  parent: {
    token: string | null;
    user: ParentUser | null;
  };

  // ── Portal slot (PLN-260706 unified student/parent/teacher) ─────────
  portal: {
    token: string | null;
    user: PortalSession | null;
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

  // ── Portal actions ──────────────────────────────────────────────────
  setPortalAuth: (token: string, user: PortalSession) => void;
  clearPortalMustChange: () => void;
  clearPortal: () => void;
}

const initialParent = { token: null, user: null };
const initialPortal = { token: null, user: null };

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      parent: initialParent,
      portal: initialPortal,
      active: null,

      setAuth: (token, user) =>
        set({ token, user, active: 'admin' }),

      clearMustChangePassword: () =>
        set((s) => (s.user ? { user: { ...s.user, mustChangePassword: false } } : {})),

      setParentAuth: (token, user) =>
        set({ parent: { token, user }, active: 'parent' }),

      setPortalAuth: (token, user) =>
        set({ portal: { token, user }, active: 'portal' }),

      clearPortalMustChange: () =>
        set((s) =>
          s.portal.user
            ? { portal: { ...s.portal, user: { ...s.portal.user, mustChangePassword: false } } }
            : {},
        ),

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

      clearPortal: () =>
        set((s) => ({
          portal: initialPortal,
          active: s.active === 'portal' ? (s.token ? 'admin' : null) : s.active,
        })),

      clear: () =>
        set({
          token: null,
          user: null,
          parent: initialParent,
          portal: initialPortal,
          active: null,
        }),
    }),
    {
      name: 'acm-auth',
      version: 4,
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<AuthState>;
        if (!version || version < 2) {
          return {
            token: p.token ?? null,
            user: p.user ?? null,
            parent: initialParent,
            portal: initialPortal,
            active: p.token ? 'admin' : null,
          } as Partial<AuthState> as AuthState;
        }
        if (version < 3) {
          return {
            token: p.token ?? null,
            user: p.user ?? null,
            parent: initialParent,
            portal: initialPortal,
            active: p.token ? 'admin' : null,
          } as AuthState;
        }
        // v3 → v4: introduce the portal slot.
        return {
          ...p,
          parent: p.parent ?? initialParent,
          portal: p.portal ?? initialPortal,
        } as AuthState;
      },
    },
  ),
);
