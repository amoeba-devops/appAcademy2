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

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'csl', element: <CslListPage /> },
      { path: 'csl/:id', element: <CslDetailPage /> },
      { path: 'cls', element: <ClsListPage /> },
      { path: 'cls/:id', element: <ClsDetailPage /> },
      { path: 'std', element: <StdListPage /> },
      { path: 'std/:id', element: <StdDetailPage /> },
      { path: 'sch', element: <SchoolListPage /> },
      { path: 'ref', element: <ReferenceListPage /> },
      { path: 'qna', element: <QnaListPage /> },
      { path: 'qna/categories', element: <QnaCategoriesPage /> },
    ],
  },
]);
