import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { RequireAuth } from '@/components/layout/require-auth';
import { LoginPage } from '@/modules/auth/pages/login-page';
import { DashboardPage } from '@/modules/dsh/pages/dashboard-page';
import { CslListPage } from '@/modules/csl/pages/csl-list-page';
import { CslDetailPage } from '@/modules/csl/pages/csl-detail-page';
import { ClsListPage } from '@/modules/cls/pages/cls-list-page';
import { ClsDetailPage } from '@/modules/cls/pages/cls-detail-page';
import { StdListPage } from '@/modules/std/pages/std-list-page';
import { StdDetailPage } from '@/modules/std/pages/std-detail-page';
import { SchoolListPage } from '@/modules/sch/pages/school-list-page';
import { ReferenceListPage } from '@/modules/ref/pages/reference-list-page';
import { QnaListPage } from '@/modules/qna/pages/qna-list-page';
import { QnaCategoriesPage } from '@/modules/qna/pages/qna-categories-page';
import { WebContactPage } from '@/modules/web/pages/web-contact-page';
import { WebTestPage } from '@/modules/web/pages/web-test-page';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },

  // Public web pages (no auth required)
  { path: '/web/contact', element: <WebContactPage /> },
  { path: '/web/test', element: <WebTestPage /> },

  // Admin pages (auth required)
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'admin', element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'admin/dashboard', element: <DashboardPage /> },
      { path: 'admin/csl', element: <CslListPage /> },
      { path: 'admin/csl/:id', element: <CslDetailPage /> },
      { path: 'admin/cls', element: <ClsListPage /> },
      { path: 'admin/cls/:id', element: <ClsDetailPage /> },
      { path: 'admin/std', element: <StdListPage /> },
      { path: 'admin/std/:id', element: <StdDetailPage /> },
      { path: 'admin/sch', element: <SchoolListPage /> },
      { path: 'admin/ref', element: <ReferenceListPage /> },
      { path: 'admin/qna', element: <QnaListPage /> },
      { path: 'admin/qna/categories', element: <QnaCategoriesPage /> },
    ],
  },
]);
