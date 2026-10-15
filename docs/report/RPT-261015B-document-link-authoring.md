---
document_id: ACM-DOCUMENT-LINK-RPT-1.0.0
version: 1.0.0
status: Implemented; not deployed
change_log:
  - version: 1.0.0
    description: Expose existing Google link registration and add XLSX import.
---
# Document Creation Refinement (문서 작성 보완)

## 1. Finding (확인 결과)
AMA 소스의 NewDocumentMenu/NewGdocMenu는 새 작성·기존 링크 등록·시트 가져오기를 명확히 구분한다. ACM 링크 저장 API는 있었으나 작성창 내부 라디오에 숨겨져 진입이 불명확했다. Fortune Sheet를 추가한 앞선 구현은 아직 운영 미배포다. 요청한 운영 URL은 접근 도구 오류로 직접 확인하지 못했다.

## 2. UI and Implementation (화면·구현)
```text
시트 탭: [스프레드시트 작성] [기존 구글시트 링크 등록] [Google에서 새로 만들기]
Docs 탭: [ACM 문서 작성] [기존 구글독스 링크 등록] [Google에서 새로 만들기]
링크 등록: 제목 + 해당 Google URL → 저장 → 목록 → iframe 미리보기 / 새 탭 열기
시트 작성: Fortune Sheet 툴바·복수 시트·수식·편집 → 저장
            [XLSX 가져오기] [XLSX 다운로드] [Google 시트 사본 생성]
```
- 기존 링크 등록 버튼은 직접 GOOGLE_LINK 모드로 진입한다. 기존 자료 열기/수정의 저장 방식은 유지한다.
- Google 공용 계정 연결 없이 링크 등록 가능. 실제 열람은 원본 Google 접근 권한을 따른다.
- URL 앞뒤 공백, 공유 쿼리, 편집 경로 없는 링크 정규화. 시트 gid 유지. 잘못된 호스트·프로토콜·사용자 정보 포함 URL 및 시트/Docs 종류 불일치 차단.
- XLSX 가져오기 추가: 복수 시트, 값, 수식, 기본 굵게/기울임 보존. 기존 시트 교체 전 확인. 오류 시 기존 편집 내용 유지.
- ExcelJS 동적 로딩의 CommonJS/ESM 호환 수정 (가져오기 테스트에서 발견).
- 동일 Fortune Sheet 엔진을 사용하지만 모든 Excel 기능 동등성은 보장하지 않는다. 현재 가져오기는 .xlsx만 지원하며 .xls/.csv는 미지원이다. 최대 업로드 20MB, 변환 본문 60KB 한도가 적용된다. 전체 서식·매크로·외부 연결은 가져오지 않는다.

## 3. Verification (검증)
- frontend-acm TypeScript/Vite 빌드 PASS.
- backend Nest 빌드 PASS.
- PostgreSQL 통합 테스트 17개 PASS.
- XLSX 가져오기 테스트 1개 PASS: 복수 시트, 숫자, 수식, 굵게, 잘못된 파일·용량 초과 거절.
- 변경된 URL 검증 코드 ESLint PASS, git diff --check PASS.
- 실제 Google 계정, 모바일·브라우저 시각 검증은 미실행. 운영 배포도 수행하지 않았다.

## 4. Delivery (반영 위치)
격리 작업 디렉터리 `/private/tmp/acm-project-261014`, 브랜치 `feat/project-ama-parity-261015`.
원본 IDE 저장소의 기존 소스 변경을 덮어쓰지 않았으며 이 보고서는 원본에도 복사했다.
이번 보완 자체의 추가 DB 변경은 없다. 앞선 프로젝트 개편과 함께 배포할 때는 1034 마이그레이션이 필요하다.
