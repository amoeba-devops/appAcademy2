import 'next-auth';

declare module 'next-auth' {
  interface User {
    role: string;
    academyId: number;
    accessToken: string;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      academyId: number;
      accessToken: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string;
    academyId: number;
    accessToken: string;
  }
}
