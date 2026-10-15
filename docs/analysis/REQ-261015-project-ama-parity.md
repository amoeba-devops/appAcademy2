---
document_id: ACM-PROJECT-REQ-1.4.0
version: 1.4.0
status: Pending review
change_log:
  - version: 1.4.0
    description: Align project overview and document experience with supplied AMA reference.
---
# AMA Project Parity Requirements (AMA 프로젝트 화면 일치 요구사항)

## 1. Sources (근거)
- 2026-10-15 사용자 제공 프로젝트 개요 스크린샷을 배치·스타일 기준으로 사용한다.
- 사용자 지정 문서 화면: https://ama.amoeba.site/documents?tab=spreadsheet , https://ama.amoeba.site/documents?tab=gdoc , https://ama.amoeba.site/documents?tab=files .
- 2026-10-14 확인 기록: 시트 목록의 검색·정렬·권한·공유 필터, 직접 작성/Google 링크 작성창, Docs 목록과 Google 신규 생성/기존 링크 작성창.
- 2026-10-15 Chrome 연결 불가 및 웹 도구 접근 불가로 최신 상세 화면을 재검증하지 못했다. 파일 탭과 실제 시트 편집기의 세부 기능은 미확인이다. AMA 소스 위치를 사용자에게 요청했다.
- 사진의 이름·이메일·문서명은 예시 데이터로 복제하지 않는다.

## 2. Requirements (요구사항)
1. 프로젝트 개요: 제목·코드·상태 헤더, 개요/문서/이슈 탭, 좌측 최근 문서 3열 및 하단 파일 카드, 우측 멤버/배정 고객사/관련 채팅방 카드.
2. 문서: 기존 메모/시트/Docs/파일 순서를 유지하며 AMA의 목록·검색·작성·링크 연동 흐름을 맞춘다. 독립 문서 메뉴와 프로젝트별 문서 탭은 같은 컴포넌트를 사용한다.
3. 시트: 직접 작성과 Google Sheets 링크 연동. 현재 기본 편집기는 기능 동등성이 검증되지 않았으므로 AMA 편집기 확인 후 부족한 기능을 확정한다.
4. Docs: Google 새 문서 생성과 기존 Google Docs 연결을 주 동작으로 한다. 기존 ACM 내부 작성 문서는 별도 표시하고 계속 열기·편집할 수 있어야 한다.
5. 파일: 제목·작성자·크기·일시·다운로드 표시. 목록/업로드/열기/연결 해제의 상세 UI는 AMA 파일 탭 확인 후 확정한다.
6. 프로젝트는 기존 요청대로 제안 없이 생성한다. 이미지의 승인됨 문구를 근거로 새 승인 절차를 도입하지 않는다.
7. Drive는 계속 ACM 독립 기본 메뉴다. 기존 문서·파일 원본·이슈·연결 주소를 보존한다.

## 3. Gaps (현재 구현 차이)
| 영역 | 현재 ACM | 필요한 변경 |
|---|---|---|
| 개요 | 설명·통계와 최근 문서 요약 | 첨부와 같은 문서 유형별 카드 및 우측 카드 |
| 멤버 | 단일 소유자·참여자, 이름 | 이메일·역할 표시, 추가/제거, 역할 정책 정의 |
| 고객사·채팅 | 프로젝트 연결 없음 | 테넌트 내 대상 조회·연결·해제 및 접근권한 검사 |
| 문서 목록 | 기본 검색·분류 | 프로젝트/수정일/권한/공유 컬럼 및 필터 |
| Docs 생성 | 내부 작성이 기본 | Google 신규 생성·기존 연결 중심 흐름 |
| 파일 | Drive 저장 방식 | AMA 파일 화면 확인 후 저장 방식·동작 확정 |

## 4. Boundaries (권한과 보존)
- 멤버·문서·고객사·채팅방은 ent_id와 프로젝트 권한을 서버에서 검사한다.
- Google 링크 등록은 원본 공유 권한을 부여하지 않는다. 비공개 원본의 공개 전환을 요구하지 않는다.
- 기존 내부 문서를 자동 Google 변환하거나 원본 파일을 삭제하지 않는다.
- 실제 Google 생성 검증에는 공용 계정 OAuth 설정·인증이 필요하다.


## 5. Source Verification Update (소스 확인 보완)
2026-10-15 사용자 제공 AMA 로컬 소스를 확인했다. 파일 통합 목록/프로젝트 파일 업로드·다운로드·공개 설정, Fortune Sheet 편집기·XLSX 내보내기·편집 세션, Google 시트/Docs iframe 뷰어를 확인했다. 상세 근거와 수정 목업은 [구현 계획 6절](../plan/PLN-261015-project-ama-parity.md#6-verified-ama-source-ama-소스-확인--2026-10-15)에 기록했다. 앞선 미확인 표기는 확인 당시 이력이며, 운영 서버와 로컬 소스의 버전 일치는 별도 검증이 필요하다.
