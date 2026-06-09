import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PortalLayout } from '@/components/layout/portal-layout';
import { ParentShell } from '@/components/layout/parent-shell';
import { RequireAuth } from '@/components/layout/require-auth';
import { LoginPage } from '@/modules/auth/pages/login-page';
import { ParentLoginPage } from '@/modules/auth/pages/parent-login-page';
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
import { MyDashboardPage } from '@/modules/my/pages/dashboard-page';
import { MyPaymentsPage } from '@/modules/my/pages/payments-page';
import { MyScoresPage } from '@/modules/my/pages/scores-page';
import { MyTimetablePage } from '@/modules/my/pages/timetable-page';
import { PostEditorPage } from '@/modules/posts/pages/post-editor-page';
import { AmaConfigPage } from '@/modules/cfg/pages/ama-config-page';

/** Preserve query string while redirecting (used for legacy login URL compat). */
function RedirectWithSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

export const router = createBrowserRouter([
  // ── Public auth pages (group-based) — REQ-260520 FR-03 ──────────────
  { path: '/admin/login', element: <LoginPage /> },
  { path: '/parent/login', element: <ParentLoginPage /> },

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
      { path: 'config', element: <AmaConfigPage /> },
    ],
  },

  // ── Fallback: unknown paths go to portal home ───────────────────────
  { path: '*', element: <Navigate to="/" replace /> },
]);
