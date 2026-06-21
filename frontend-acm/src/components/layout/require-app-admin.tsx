import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

/**
 * REQ-260621 — gate for /system/* (system administration).
 *
 * Requires an admin session AND role === 'APP_ADMIN'. The backend independently
 * enforces this on every /acm/system/* endpoint (RolesGuard); this is the
 * client-side guard so non-app-admins never see the shell.
 */
export function RequireAppAdmin({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  const location = useLocation();

  if (!token) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?returnTo=${returnTo}`} replace />;
  }
  if (role !== 'APP_ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}
