import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/admin/login',
  },
});

// Guards every admin route. /admin/login itself is intentionally excluded
// from the matcher so NextAuth can redirect unauthenticated users there.
export const config = {
  matcher: [
    '/admin/dashboard/:path*',
    '/admin/consultations/:path*',
    '/admin/students/:path*',
    '/admin/teachers/:path*',
    '/admin/program-mgmt/:path*',
    '/admin/classes/:path*',
    '/admin/timetable/:path*',
    '/admin/enrollments/:path*',
    '/admin/map/:path*',
    '/admin/payments/:path*',
    '/admin/settings/:path*',
  ],
};
