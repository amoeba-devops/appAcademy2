---
document_id: ACM-PROJECT-RPT-1.4.0
version: 1.4.0
status: Implemented; visual and live Google verification pending
change_log:
  - version: 1.4.0
    description: Project overview and AMA document workflow implementation.
---
# Project UI and Documents (프로젝트 UI·문서 구현 보고)

## 1. Changes (구현 내용)
- 첨부 구조에 맞춘 프로젝트 개요: 유형별 최근 문서 3열, 하단 파일 카드, 우측 멤버·고객사·채팅방 카드. 실제 멤버 이름/이메일/역할 표시. 좁은 화면에서는 카드 세로 배치.
- 독립 `/admin/documents` 메뉴와 유형별 목록: 검색, 정렬, 프로젝트·권한·Google 연동 필터, 파일 단계·크기·다운로드 수 정렬, 문서 ID 복사. 프로젝트 문서도 표 형태로 변경.
- 메모 리치에디터 유지. Fortune Sheet 1.0.4(MIT, React >=18.2) 편집기 도입. 기존 셀 JSON은 열 때 version 2 워크북으로 변환하며 저장 전 기존 데이터는 변경하지 않는다. 편집 중 마지막 셀을 저장 스냅샷에 반영한다.
- 시트 XLSX 내보내기, Google 시트 사본 생성. 대형 의존성은 편집기 진입 때 별도 로딩한다. XLSX는 값·수식과 기본 굵게/기울임을 반영한다. 전체 서식 호환을 보장하지 않는다.
- Google 링크 문서와 Drive에서 생성한 시트/Docs의 iframe 미리보기, 새 탭 열기. 원본 접근 권한은 Google 정책을 따른다.
- 문서별 편집자/뷰어 지정 및 서버 수정·제거 차단. 프로젝트 담당자는 편집 권한을 유지하며, 타 테넌트와 비참여자 접근을 차단한다.
- 파일 선택/드래그앤드롭, 제목·설명·단계 입력, 업로드 진행률, 최대 20MB. 연결된 Drive 우선, 미연결 시 ACM ObjectStore 저장. 다운로드 요청 수 집계와 목록 제거 제공. 목록 제거는 원본 보존이다.
- 파일 업로드 UUID 기반 중복 방지 및 제거한 요청 ID 재사용 차단.
- 고객사명 등록/연결 해제, 참여 중인 채팅방 연결/해제/바로가기. 서버에서 프로젝트 관리 권한과 채팅방 참여 여부 확인.

## 2. Data and API (데이터·API)
- 마이그레이션: `sql/acm/1034-project-parity.sql`.
- `amb_acm_prj_relation`: 프로젝트별 고객사명/채팅방 연결.
- `amb_acm_prj_item`: `file_phase`, `object_key`, `download_count`, `viewer_ids` 추가. 기존 문서·Drive 원본 보존.
- `/acm/prj/documents`, 프로젝트 relations, files 업로드/다운로드, items permissions API 추가.
- 운영 배포 전에 1034 적용 필요. 현재 운영 DB에는 적용하지 않았다.

## 3. Verification (검증)
- frontend-acm TypeScript + Vite build PASS.
- backend Nest build PASS.
- 변경 백엔드 서비스/컨트롤러 ESLint PASS (0 errors, 0 warnings).
- PostgreSQL 16 Testcontainers 통합 테스트 16개 PASS: 기존 12개 및 워크북/문서 권한/파일 업로드·다운로드/프로젝트 매니저 회귀 검증.
- `git diff --check` PASS.
- 브라우저 도구 `Sky Computer Use native pipe startup failed`로 실제 화면 비교·캡처·모바일 터치 검증은 수행하지 못했다. 픽셀 단위 동일성 검증 완료로 표시하지 않는다.
- 실제 공용 Google 계정 OAuth·파일 변환·iframe 동작은 미검증이다.
- Vite 대형 chunk 경고 존재. Fortune Sheet와 ExcelJS는 지연 로딩한다.

## 4. Scope Differences and Remaining Checks (범위 차이·남은 검증)
- ACM에는 AMA의 고객사 계정 마스터/고객사 포털 모델이 없다. 현재 고객사 카드는 프로젝트별 이름 등록이며, 고객사 포털 공개 토글·실제 고객사 계정 배정은 포함하지 않았다.
- 프로젝트 담당자 외 복수 매니저를 지정할 수 있도록 역할 컬럼과 서버 관리 권한 검사를 추가했다.
- 원본 Google 공유 권한을 자동 부여/공개 전환하지 않는다. Google 시트 사본 생성은 문서 생성 기능이며 Google 계정별 권한 관리 UI는 포함하지 않는다.
- 시트 본문은 기존 60KB 한도, 최대 20개 시트/10,000행/500열 서버 검증. 외부 이미지/하이퍼링크 메타데이터는 저장하지 않는다. 큰 워크북은 Google 링크 방식 사용.
- 기존 프로젝트에도 안정적인 PJ-연월-일련번호 코드를 발급하고 신규 생성 기본값을 추가했다. 기존 UUID는 API 식별자로 유지한다.
- 운영 배포 미실행. 이 보고서는 전체 AMA 기능 동등성 또는 운영 검증 완료를 의미하지 않는다.

## 5. Workspace (작업 위치)
- 소스: `/private/tmp/acm-project-261014` (격리 작업 디렉터리).
- 원본 IDE 저장소의 기존 미커밋 소스는 보존했다. 보고서·계획 문서만 원본에도 복사했다.
- AMA `/Users/gray/Desktop/Site/ambManagement`는 참조 목적으로만 읽었으며 수정하지 않았다.
