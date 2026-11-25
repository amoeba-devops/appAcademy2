/**
 * REQ-261125-CAL — 달력 일정 문구. 관리자 달력과 강사 포털이 같은 문구를 쓴다.
 *
 *   "17:00 | 홍길동 | 영어"
 *   - 학생: 일정 참석자로 등록된 시스템 학생만 (여러 명이면 쉼표)
 *   - 제목: 학생 이름과 같으면 생략 → "18:00 | 김학생"
 *   - 학생 없음 → "17:00 | 영어", 종일 → "홍길동 | 영어"
 */
export interface EventLineSource {
  title: string;
  studentNames?: string[] | null;
  primaryStudentName?: string | null;
}

/** 시스템에 등록된 참석 학생 이름 목록. */
export function eventStudentNames(e: EventLineSource): string[] {
  if (e.studentNames?.length) return e.studentNames;
  return e.primaryStudentName ? [e.primaryStudentName] : [];
}

/** 제목이 학생 이름과 같으면 null (중복 표기 방지). */
export function eventTitlePart(e: EventLineSource): string | null {
  const title = e.title?.trim() ?? '';
  if (!title) return null;
  const names = eventStudentNames(e);
  if (names.includes(title) || names.join(', ') === title) return null;
  return title;
}

/** "시간 | 학생 | 제목" (빈 부분은 뺀다). timeLabel 은 24시간 "HH:mm", 종일이면 ''. */
export function eventLine(timeLabel: string, e: EventLineSource): string {
  return [timeLabel, eventStudentNames(e).join(', '), eventTitlePart(e)]
    .filter((part): part is string => !!part)
    .join(' | ');
}
