'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const token = params.get('token');
    const next = params.get('next') ?? 'dashboard';
    const returnTo = params.get('returnTo');

    if (!token) {
      setError('NO_TOKEN');
      return;
    }

    void (async () => {
      const result = await signIn('ama-token', { token, redirect: false });
      if (!result?.ok) {
        setError(result?.error ?? 'SIGNIN_FAILED');
        return;
      }
      const target =
        returnTo && returnTo.startsWith('/')
          ? returnTo
          : next === 'onboarding'
            ? '/admin/onboarding'
            : next === 'select-tenant'
              ? '/admin/select-tenant'
              : '/admin/dashboard';
      router.replace(target);
      router.refresh();
    })();
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-md border border-slate-200 bg-white px-6 py-5 shadow-sm">
        {error ? (
          <div className="text-sm text-red-700">
            <p className="font-semibold">로그인을 완료할 수 없습니다.</p>
            <p className="mt-1 text-xs text-slate-500">사유: {error}</p>
            <a
              href="/admin/login"
              className="mt-3 inline-block rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white"
            >
              로그인 페이지로
            </a>
          </div>
        ) : (
          <p className="text-sm text-slate-600">AMA 인증 처리 중…</p>
        )}
      </div>
    </div>
  );
}

export default function AmaCallbackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">로딩 중…</div>}>
      <CallbackInner />
    </Suspense>
  );
}
