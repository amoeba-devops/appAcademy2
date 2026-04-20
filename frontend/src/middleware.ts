import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

// Protect all admin routes except login and portal pages
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/consultations/:path*',
    '/students/:path*',
    '/teachers/:path*',
    '/programs/:path*',
    '/timetable/:path*',
    '/enrollments/:path*',
    '/map/:path*',
    '/payments/:path*',
    '/settings/:path*',
  ],
};
