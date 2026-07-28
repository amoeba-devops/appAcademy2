/**
 * PLN-260728D — 공지(게시글) slug 유틸.
 *
 * 서버 규칙(`CreateAdminPostDto.slug`)과 동일한 형식만 허용:
 *   ^[a-z0-9]+(?:-[a-z0-9]+)*$  (영소문자·숫자·하이픈, 앞뒤/연속 하이픈 불가)
 * 한글 등 비허용 문자는 제거되므로, 결과가 비면 fallback slug 를 쓴다.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** 임의 문자열 → 서버 허용 slug 로 정규화. 실패 시 빈 문자열. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-') // 공백·언더스코어 → 하이픈
    .replace(/[^a-z0-9-]/g, '') // 허용 외 문자(한글 등) 제거
    .replace(/-+/g, '-') // 연속 하이픈 축약
    .replace(/^-+|-+$/g, ''); // 앞뒤 하이픈 제거
}

/** 제목이 한글 전용 등으로 slug 가 비는 경우의 대체값: `post-yyyymmddHHmm`. */
export function fallbackSlug(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `post-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(
    now.getHours(),
  )}${p(now.getMinutes())}`;
}

/** 제목 기반 slug(자동생성). 정규화 결과가 비면 fallback 사용. */
export function slugFromTitle(title: string, now: Date): string {
  return slugify(title) || fallbackSlug(now);
}
