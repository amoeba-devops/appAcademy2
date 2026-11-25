---
document_id: ACM-PORTAL-UI-RPT-1.0.0
version: 1.0.0
status: implemented_locally
date: 2026-11-25
source_baseline: 7c17137
branch: feat/portal-ui-261125
change_log:
  - 2026-11-25 v1.0.0 승인된 핵심 포털 UI 구현·로컬 검증 결과
---

# Portal UI Implementation Report (학원포털 UI 개선 구현 보고서)

## 1. Outcome (결과)

사용자의 “진행” 승인에 따라 첨부 목업의 핵심 UI 개선을 구현했다. 기존 역할·테넌트 권한과 정보 비노출 요구를 유지한다. 이 보고서의 화면은 로컬 구현 화면을 가상 데이터로 검증한 자료이며 운영 화면 변경이나 배포 완료를 의미하지 않는다.

| 영역 | 구현 내용 |
| --- | --- |
| 공통 셸 | 240px 데스크톱 메뉴, 태블릿 아이콘 레일, 모바일 하단 탐색·더보기, 본문 이동 링크 |
| 계정·메뉴 | 이메일을 프로필로 모으고 계정 진입 유지. 메뉴 로딩·오류 시 비허용 기능을 노출하지 않음 |
| 공지사항 | 강사·학생 설정, 메뉴 숨김·직접 진입 제한·설정 갱신 정책 유지 |
| 수업일정 | 제목·공통 필터, 모바일 기본 일간 목록·주간 날짜 스트립, 학생별 칩 색상·24시간 표시·그룹 이름 |
| 일정 상태 | 날짜·보기·필터 URL 유지, 상세 복귀 경로 보존, 초과 일정 더보기 유지, 연초 월 그리드 계산 보정 |
| 수강생 | 내 담당 / 전체보기(퇴원 포함), 전체 허용 목록의 이름·영문명·학교 검색, 이름순, 이니셜 카드·상태 |
| 수강생 상세 | 검색·전체보기 복귀, 날짜 전용 값의 하루 밀림 방지, 학습 목표·기존 링크·기록 유지 |
| 자료실 | 데스크톱 표·모바일 목록, 제목 전체 검색·서버 페이지네이션, 댓글·더보기·공유·삭제 확인 |
| 채팅 | 포털 대화 검색·안읽음 필터, 모바일 목록/대화 URL 이동·뒤로가기, 대화 중 하단 탐색 숨김, 입력창 영역 보정 |
| 알림·내 정보 | 플로팅 대신 인라인 기기 알림 안내, 본문·알림함·내 정보의 수신/닫기 상태 동기화, 보안·로그아웃 |
| 번역 | 신규 UI 문구 ko/en/vi/zh-CN 제공 |

특이사항과 강사·학생 사용자 지정 타임존은 계속 비노출이다. 전체보기는 학원 전체 학생으로 확대되지 않는다. 자료실의 파일 다운로드·공유·삭제와 문서 열기는 기존 권한별 동작을 재사용했다.

## 2. API and Data (API·데이터)

자료실 GET /api/portal/materials에 선택 query q를 추가했다. 공백 제거·최대 100자 제목 검색이며 기존 scope/kind/page/limit과 결합한다.

- 내 게시물: 학원·작성자·종류 조건과 함께 검색한 다음 DB에서 집계·페이지 처리한다.
- 공유 게시물: 기존 직접 공유·반 자료 접근 범위를 먼저 합치고 제목 검색한 다음 집계·페이지 처리한다.
- 검색은 대소문자를 구분하지 않으며 SQL 패턴 문자는 literal로 이스케이프한다.
- 동일 생성 시각의 페이지 순서를 ID로 안정화했다.
- 기존 응답 형식·작성·공유·삭제 권한과 다운로드 API를 바꾸지 않았다.
- 신규 테이블·DB 마이그레이션·영구 데이터 변경이 없다.
- 포털 자료실 캐시는 학원·계정·역할을 포함해 분리했다.

다음 수업 묶음 조회·정렬, 작성자 검색·제출 대기 필터, 수업 사전 알림 예약, 포털 일정 추가·배정은 원 계획의 선택 확장/별도 기능으로 남긴다. 준비되지 않은 정보·조작을 더미 UI로 노출하지 않았다.

## 3. Validation (검증)

| 검증 | 결과 |
| --- | --- |
| 프런트엔드 TypeScript·Vite 프로덕션 빌드 | 통과. 기존 대형 청크 경고는 남아 있음 |
| 백엔드 NestJS 빌드 | 통과 |
| 관련 백엔드 테스트 | 3 suites / 44 tests 통과 |
| 자료실 추가 테스트 | 검색의 학원·작성자 범위, 패턴 문자 처리, 병합 뒤 검색·집계·페이지 순서 확인 |
| 변경 백엔드 파일 ESLint | 0 errors. 기존 경고와 테스트 모킹 관련 warnings는 별도 유지 |
| 신규 브라우저 검증 | 375/390/640/768/1024/1280, 강사·학생·학부모, 4개 언어 통과 |
| 기존 포털 노출 회귀 | 강사 전용 일정, 타임존, 퇴원생, 관리자 업무 메뉴 순서 통과 |
| 기존 포털 메뉴 회귀 | 공지 ON/OFF 네 조합, 다른 탭 설정 갱신, 실패 시 비노출·재시도, 특이사항 비노출 통과 |
| 경계 조건 | 2027년 1월 6주 달력, 음수 UTC 시간대 수강 시작 날짜, 상세 복귀 검색 조건 확인 |
| 알림·채팅 | 인라인 안내, 모바일 대화 목록/대화 URL, 계정 접근, 입력창·하단 탐색 영역 확인 |

테스트는 모든 API 응답을 가상 데이터로 대체했다. 실제 학생·키·일정·메시지 변경은 수행하지 않았다. 단위 테스트의 로컬 HTTP 리스닝은 허용된 환경에서 재실행해 통과를 확인했다.

주요 실행 명령:

~~~sh
# frontend-acm
npm run build

# backend
npm run build
npm test -- --runInBand --testPathPatterns='portal-(material|teacher-students|menu).*spec|portal-menu.*spec'

# repository root / fixed frontend port 3009
python3 frontend-acm/test/portal-ui.smoke.py
python3 frontend-acm/test/portal-visibility.smoke.py
python3 frontend-acm/test/portal-menus.smoke.py
~~~

## 4. Screens (구현 화면)

가상 데이터만 사용한 실제 구현 화면이다.

| 화면 | 캡처 |
| --- | --- |
| 데스크톱 월간 일정 | [보기](assets/portal-ui-261125/calendar-desktop.png) |
| 모바일 일정 목록 | [보기](assets/portal-ui-261125/calendar-mobile.png) |
| 데스크톱 전체보기 | [보기](assets/portal-ui-261125/students-desktop.png) |
| 태블릿 메뉴 레일·수강생 | [보기](assets/portal-ui-261125/students-tablet.png) |
| 모바일 학생 상세 | [보기](assets/portal-ui-261125/student-detail-mobile.png) |
| 자료실 표·전체 제목 검색 | [보기](assets/portal-ui-261125/materials-desktop.png) |
| 모바일 대화방 | [보기](assets/portal-ui-261125/chat-mobile.png) |
| 모바일 마이페이지 | [보기](assets/portal-ui-261125/profile-mobile.png) |

## 5. Review and Release (검토·배포 상태)

별도 작업 폴더에서 구현하여 기존 작업 폴더의 미완료 변경과 분리했다. 검토용 변경은 [PR #452](https://github.com/amoeba-devops/appAcademy2/pull/452)에 정리했다. 최신 자동 검증 결과는 [PR Checks](https://github.com/amoeba-devops/appAcademy2/pull/452/checks)에서 확인할 수 있다. 운영 반영은 별도 배포 단계이며 현재 운영 배포 완료로 표시하지 않는다.

- [승인된 요구사항](../analysis/REQ-261125-portal-ui-improvement.md)
- [작업 계획](../plan/PLN-261125-portal-ui-improvement.md)
- [참고 목업 검토본](../design/portal-ui-review-261125/index.html)
