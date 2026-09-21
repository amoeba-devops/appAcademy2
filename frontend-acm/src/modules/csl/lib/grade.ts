import type { TFunction } from 'i18next';

/**
 * REQ-260921B — 학년은 자유 입력이다. 과거 콘솔 셀렉트가 남긴 코드값
 * (E1~E6/M1~M3/H1~H3/OTHER)은 라벨로 보여 주고, 그 외는 원문 그대로.
 */
const LEGACY_GRADE_CODES = new Set([
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6',
  'M1', 'M2', 'M3',
  'H1', 'H2', 'H3',
  'OTHER',
]);

export function formatGrade(t: TFunction, value?: string | null): string {
  if (!value) return '';
  return LEGACY_GRADE_CODES.has(value) ? t(`csl:grade.${value}`, value) : value;
}

export const INQUIRY_KINDS = ['TUTORING', 'MAP_TEST'] as const;
export type InquiryKind = (typeof INQUIRY_KINDS)[number];
export const INQUIRY_GENDERS = ['M', 'F'] as const;
export type InquiryGender = (typeof INQUIRY_GENDERS)[number];

/** 구분 배지 색 — 맵테스트는 보라, 튜터링은 회색. */
export const KIND_BADGE_CLASS: Record<InquiryKind, string> = {
  MAP_TEST: 'border-violet-300 bg-violet-50 text-violet-800',
  TUTORING: 'border-[var(--border-subtle)] bg-[var(--gray-100)] text-secondary',
};
