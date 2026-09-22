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

const TRANSITION_DEFAULTS: Record<string, string> = {
  TRANSITION_NOT_ALLOWED: "현재 단계에서 이동할 수 없는 단계입니다.",
  ANONYMOUS_CANNOT_PROGRESS:
    "익명 상담은 학생 이름을 먼저 입력해야 다음 단계로 갈 수 있습니다.",
  GATE_TRIAL_SKIP_REQUIRES_MAP:
    "접수에서 바로 데모수업으로 가려면 이전 MAP 점수 또는 응시료 납부/면제 기록이 필요합니다.",
  GATE_TRIAL_CLASS_REQUIRED:
    "수강상담 단계로 가려면 데모수업 기록이 1건 이상 필요합니다. 3단계 패널에서 데모수업을 등록하세요.",
  GATE_COUNSEL_NOT_DONE:
    "결제 단계로 가려면 수강상담 완료(예)로 표시해야 합니다.",
  GATE_TUITION_NOT_PAID:
    "수업 시작 단계로 가려면 수강료 납부가 확인돼야 합니다.",
  GATE_STUDENT_NOT_REGISTERED:
    "수강중으로 바꾸려면 학생이 학생관리에 등록돼 있어야 합니다.",
};

/**
 * 단계 전환 실패 문구. `csl:transition.errors.<code>` 키가 있으면 그것을,
 * 없으면 한국어 기본 문구, 그마저 없으면 서버 message → fallback.
 */
export function transitionErrorMessage(
  t: TFunction,
  e: unknown,
  fallback: string,
): string {
  const { code, message } = apiErrorParts(e);
  if (code && TRANSITION_DEFAULTS[code]) {
    return t(`csl:transition.errors.${code}`, {
      defaultValue: TRANSITION_DEFAULTS[code],
    });
  }
  return message ?? (e as ApiErrorLike)?.message ?? fallback;
}
