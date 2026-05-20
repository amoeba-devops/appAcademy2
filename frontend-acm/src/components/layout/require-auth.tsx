import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type AuthRole } from '@/stores/auth.store';

interface Props {
  children: ReactNode;
  /** Default: 'admin' (backward compatible with existing usage). */
  required_role?: AuthRole;
}

export function RequireAuth({ children, required_role = 'admin' }: Props) {
  const adminToken = useAuthStore((s) => s.token);
  const parentToken = useAuthStore((s) => s.parent.token);
  const location = useLocation();

  const token = required_role === 'parent' ? parentToken : adminToken;
  if (!token) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    // REQ-260520 FR-03 — group-based auth URLs.
    const loginPath = required_role === 'parent' ? '/parent/login' : '/admin/login';
    return <Navigate to={`${loginPath}?returnTo=${returnTo}`} replace />;
  }
  return <>{children}</>;
}
