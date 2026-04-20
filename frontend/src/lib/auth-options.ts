import { type AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'admin-credentials',
      name: 'Admin Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const res = await fetch(
          `${process.env.BACKEND_URL ?? 'http://localhost:4000'}/api/auth/login`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          },
        );

        if (!res.ok) {
          return null;
        }

        const json = await res.json();
        const payload = json?.data ?? json;
        if (!payload?.user) {
          return null;
        }

        return {
          id: String(payload.user.id),
          name: payload.user.name,
          email: payload.user.email,
          role: payload.user.role,
          academyId: payload.user.academyId,
          accessToken: payload.accessToken,
        };
      },
    }),
    CredentialsProvider({
      id: 'parent-credentials',
      name: 'Parent OTP',
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        otp: { label: 'OTP', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.otp) {
          return null;
        }

        const res = await fetch(
          `${process.env.BACKEND_URL ?? 'http://localhost:4000'}/api/auth/parent/verify-otp`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: credentials.phone,
              otp: credentials.otp,
            }),
          },
        );

        if (!res.ok) {
          return null;
        }

        const json = await res.json();
        const payload = json?.data ?? json;
        if (!payload?.parent) {
          return null;
        }

        return {
          id: String(payload.parent.id),
          name: payload.parent.name,
          email: '',
          role: payload.parent.role,
          academyId: payload.parent.academyId,
          accessToken: payload.accessToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.academyId = (user as any).academyId;
        token.accessToken = (user as any).accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).academyId = token.academyId;
        (session.user as any).accessToken = token.accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  secret: process.env.NEXTAUTH_SECRET ?? 'tac-nextauth-dev-secret',
};
