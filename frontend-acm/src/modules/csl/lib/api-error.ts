import type { TFunction } from "i18next";

/**
 * FIX-260922B — 상담 단계 전환 오류를 사람이 읽을 수 있는 문구로.
 *
 * 백엔드 GlobalExceptionFilter 응답은 `{ success:false, error:{ code, message } }`
 * 인데, 기존 화면들은 `response.data.message` 를 읽어 항상 undefined → axios 의
 * "Request failed with status code 400" 만 보였다. 여기서 code → i18n 매핑,
 * 없으면 서버 message, 그것도 없으면 폴백을 돌려준다.
 */
export interface ApiErrorLike {
  response?: {
    status?: number;
    data?: {
      message?: string | string[];
      error?: { code?: string; message?: string | string[] };
    };
  };
  message?: string;
}

/** 서버가 내려준 code / message 를 응답 형태에 상관없이 꺼낸다. */
export function apiErrorParts(e: unknown): { code?: string; message?: string } {
  const err = (e ?? {}) as ApiErrorLike;
  const data = err.response?.data;
  const raw = data?.error?.message ?? data?.message;
  const message = Array.isArray(raw) ? raw.join(", ") : raw;
  return { code: data?.error?.code, message };
}

/** `csl:transition.errors.<code>` 로 번역되는 단계 전환 오류 코드. */
const TRANSITION_ERROR_CODES = new Set<string>([
  "TRANSITION_NOT_ALLOWED",
  "ANONYMOUS_CANNOT_PROGRESS",
  "GATE_TRIAL_SKIP_REQUIRES_MAP",
  "GATE_TRIAL_CLASS_REQUIRED",
  "GATE_COUNSEL_NOT_DONE",
  "GATE_TUITION_NOT_PAID",
  "GATE_STUDENT_NOT_REGISTERED",
  "SKIP_TRIAL_FORBIDDEN",
  "SKIP_TRIAL_ONLY_FOR_COUNSELING",
]);

/**
 * 단계 전환 실패 문구. `csl:transition.errors.<code>` 키가 있으면 그것을,
 * 없으면 서버 message → fallback.
 */
export function transitionErrorMessage(
  t: TFunction,
  e: unknown,
  fallback: string,
): string {
  const { code, message } = apiErrorParts(e);
  if (code && TRANSITION_ERROR_CODES.has(code)) {
    return t(`csl:transition.errors.${code}`);
  }
  return message ?? (e as ApiErrorLike)?.message ?? fallback;
}
