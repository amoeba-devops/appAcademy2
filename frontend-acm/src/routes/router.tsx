import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PortalLayout } from '@/components/layout/portal-layout';
import { ParentShell } from '@/components/layout/parent-shell';
import { RequireAuth } from '@/components/layout/require-auth';
import { LoginPage } from '@/modules/auth/pages/login-page';
import { ParentLoginPage } from '@/modules/auth/pages/parent-login-page';
import { ChangePasswordPage } from '@/modules/auth/pages/change-password-page';
import { DashboardPage } from '@/modules/dsh/pages/dashboard-page';
import { CslListPage } from '@/modules/csl/pages/csl-list-page';
import { CslDetailPage } from '@/modules/csl/pages/csl-detail-page';
import { ClsListPage } from '@/modules/cls/pages/cls-list-page';
import { ClsDetailPage } from '@/modules/cls/pages/cls-detail-page';
import { StdListPage } from '@/modules/std/pages/std-list-page';
import { StdDetailPage } from '@/modules/std/pages/std-detail-page';
import { ParentListPage } from '@/modules/std/pages/parent-list-page';
import { SchoolListPage } from '@/modules/sch/pages/school-list-page';
import { ReferenceListPage } from '@/modules/ref/pages/reference-list-page';
import { PostsListPage } from '@/modules/posts/pages/posts-list-page';
import { NotificationsListPage } from '@/modules/notifications/pages/notifications-list-page';
import { EnrollmentsListPage } from '@/modules/enrollments/pages/enrollments-list-page';
import { QnaListPage } from '@/modules/qna/pages/qna-list-page';
import { QnaCategoriesPage } from '@/modules/qna/pages/qna-categories-page';
import { WebContactPage } from '@/modules/web/pages/web-contact-page';
import { WebTestPage } from '@/modules/web/pages/web-test-page';
import { WebClassroomPage } from '@/modules/web/pages/web-classroom-page';
import { TchListPage } from '@/modules/tch/pages/tch-list-page';
import { StfListPage } from '@/modules/stf/pages/stf-list-page';
import { CalMonthPage } from '@/modules/cal/pages/cal-month-page';
import { MpqListPage } from '@/modules/map/pages/mpq-list-page';
import { PortalHomePage } from '@/modules/portal/pages/home-page';
import { AboutPage } from '@/modules/portal/pages/about-page';
import { ProgramsPage } from '@/modules/portal/pages/programs-page';
import { ProgramDetailPage } from '@/modules/portal/pages/program-detail-page';
import { NewsListPage } from '@/modules/portal/pages/news-list-page';
import { NewsDetailPage } from '@/modules/portal/pages/news-detail-page';
import { PortalLoginPage } from '@/modules/portal-app/pages/portal-login-page';
import { PortalChangePasswordPage } from '@/modules/portal-app/pages/portal-change-password-page';
import { PortalShell } from '@/modules/portal-app/components/portal-shell';
import { PortalCalendarPage } from '@/modules/portal-app/pages/portal-calendar-page';
import { PortalCalEventDetailPage } from '@/modules/portal-app/pages/portal-cal-event-detail-page';
import { PortalMaterialsPage } from '@/modules/portal-app/pages/portal-materials-page';
import {
  PortalNoticesPage,
  PortalNoticeDetailPage,
} from '@/modules/portal-app/pages/portal-notices-page';
import { MyDashboardPage } from '@/modules/my/pages/dashboard-page';
import { MyPaymentsPage } from '@/modules/my/pages/payments-page';
import { MyScoresPage } from '@/modules/my/pages/scores-page';
import { MyTimetablePage } from '@/modules/my/pages/timetable-page';
import { PostEditorPage } from '@/modules/posts/pages/post-editor-page';
import { ConfigLandingPage } from '@/modules/cfg/pages/config-landing-page';
import { AmaConfigPage } from '@/modules/cfg/pages/ama-config-page';
import { BodaConfigPage } from '@/modules/cfg/pages/boda-config-page';
import { SystemShell } from '@/components/layout/system-shell';
import { RequireAppAdmin } from '@/components/layout/require-app-admin';
import { SystemAdminPage } from '@/modules/system/pages/system-admin-page';
import { TenantListPage } from '@/modules/system/pages/tenant-list-page';
import { TenantDetailPage } from '@/modules/system/pages/tenant-detail-page';

/** Preserve query string while redirecting (used for legacy login URL compat). */
function RedirectWithSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

export const router = createBrowserRouter([
  // ── Public auth pages (group-based) — REQ-260520 FR-03 ──────────────
  { path: '/admin/login', element: <LoginPage /> },
  { path: '/parent/login', element: <ParentLoginPage /> },
  // REQ-260621 — forced password rotation (standalone, no shell).
  {
    path: '/admin/change-password',
    element: (
      <RequireAuth>
        <ChangePasswordPage />
      </RequireAuth>
    ),
  },

  // ── Legacy auth URL redirects (1-sprint backward-compat) ────────────
  { path: '/login', element: <RedirectWithSearch to="/admin/login" /> },
  { path: '/login/parent', element: <RedirectWithSearch to="/parent/login" /> },

  // ── Public web forms (legacy paths, kept) ───────────────────────────
  { path: '/web/contact', element: <WebContactPage /> },
  { path: '/web/test', element: <WebTestPage /> },
  // ── BODA(보다에듀) 화상 강의실 런처 — REQ-260526 v2 T5 ────────────────
  { path: '/web/classroom/:evtId', element: <WebClassroomPage /> },

  // ── Public portal pages (Phase 1 stubs → Phase 3 implementation) ────
  {
    path: '/',
    element: <PortalLayout />,
    children: [
      { index: true, element: <PortalHomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'programs', element: <ProgramsPage /> },
      { path: 'programs/:id', element: <ProgramDetailPage /> },
      { path: 'news', element: <NewsListPage /> },
      { path: 'news/:slug', element: <NewsDetailPage /> },
    ],
  },

  // ── Parent portal (requires parent JWT) ─────────────────────────────
  {
    path: '/my',
    element: (
      <RequireAuth required_role="parent">
        <ParentShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <MyDashboardPage /> },
      { path: 'payments', element: <MyPaymentsPage /> },
      { path: 'scores', element: <MyScoresPage /> },
      { path: 'timetable', element: <MyTimetablePage /> },
    ],
  },

  // ── Unified portal (student/parent/teacher) — PLN-260706 Phase 2 ────
  { path: '/portal/login', element: <PortalLoginPage /> },
  {
    path: '/portal/change-password',
    element: (
      <RequireAuth required_role="portal">
        <PortalChangePasswordPage />
      </RequireAuth>
    ),
  },
  {
    path: '/portal',
    element: (
      <RequireAuth required_role="portal">
        <PortalShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/portal/notices" replace /> },
      { path: 'notices', element: <PortalNoticesPage /> },
      { path: 'notices/:slug', element: <PortalNoticeDetailPage /> },
      { path: 'calendar', element: <PortalCalendarPage /> },
      { path: 'calendar/:evtId', element: <PortalCalEventDetailPage /> },
      { path: 'materials', element: <PortalMaterialsPage /> },
    ],
  },

  // ── Admin console (requires admin JWT) ──────────────────────────────
  {
    path: '/admin',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'csl', element: <CslListPage /> },
      { path: 'csl/:id', element: <CslDetailPage /> },
      { path: 'cls', element: <ClsListPage /> },
      { path: 'cls/:id', element: <ClsDetailPage /> },
      { path: 'std', element: <StdListPage /> },
      { path: 'std/parents', element: <ParentListPage /> },
      { path: 'std/:id', element: <StdDetailPage /> },
      { path: 'tch', element: <TchListPage /> },
      { path: 'stf', element: <StfListPage /> },
      { path: 'cal', element: <CalMonthPage /> },
      { path: 'map', element: <MpqListPage /> },
      { path: 'sch', element: <SchoolListPage /> },
      { path: 'ref', element: <ReferenceListPage /> },
      { path: 'posts', element: <PostsListPage /> },
      { path: 'posts/new', element: <PostEditorPage /> },
      { path: 'posts/:id', element: <PostEditorPage /> },
      { path: 'notifications', element: <NotificationsListPage /> },
      { path: 'enrollments', element: <EnrollmentsListPage /> },
      { path: 'qna', element: <QnaListPage /> },
      { path: 'qna/categories', element: <QnaCategoriesPage /> },
      // REQ-260621 — Configuration: landing card menu + per-integration pages.
      { path: 'config', element: <ConfigLandingPage /> },
      { path: 'config/ama', element: <AmaConfigPage /> },
      { path: 'config/boda', element: <BodaConfigPage /> },
    ],
  },

  // ── System administration (APP_ADMIN, cross-tenant) — REQ-260621 ────
  {
    path: '/system',
    element: (
      <RequireAppAdmin>
        <SystemShell />
      </RequireAppAdmin>
    ),
    children: [
      { index: true, element: <Navigate to="/system/admin" replace /> },
      { path: 'admin', element: <SystemAdminPage /> },
      { path: 'tenants', element: <TenantListPage /> },
      { path: 'tenants/:entId', element: <TenantDetailPage /> },
    ],
  },

  // ── Fallback: unknown paths go to portal home ───────────────────────
  { path: '*', element: <Navigate to="/" replace /> },
]);
