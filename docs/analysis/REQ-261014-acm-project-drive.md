---
document_id: ACM-PROJECT-REQ-1.0.0
version: 1.0.0
status: Implemented; pending live Google verification and deployment
change_log:
  - version: 1.0.0
    description: Lightweight projects with academy-shared Google Drive integration.
---
# Lightweight Projects Requirements (간편 프로젝트 요구사항)

## 1. Confirmed Scope (확정 요구)
- 제안 단계 없이 프로젝트를 즉시 생성한다.
- 프로젝트별 이슈, 문서, 파일, 노트를 관리한다.
- Google Docs/Sheets 신규 생성 및 기존 문서 연결을 제공한다.
- 외부 저장소 연동은 Google Drive만 구현한다.
- 사용자 확인: 학원 공용 Google 계정 하나 연결, 프로젝트별 폴더 사용.

## 2. Proposed Behavior (구현 기준안)
- 좌측 프로젝트 메뉴 → 프로젝트 목록 → 상세의 이슈/문서/파일/노트 탭.
- 프로젝트: 이름, 설명, 담당자/참여자, 진행중/완료/보관. 생성에 제안·승인 단계 없음.
- 이슈: 제목, 내용, 담당자, 기한, 상태(할 일/진행중/완료), 목록/수정.
- 노트: 제목/본문 등록·수정. ACM DB에 저장.
- 문서: Google 문서/시트 생성, Google Picker로 기존 문서 연결, 새 창으로 열기. 편집기 자체 구현은 제외.
- 파일: 공용 Drive의 프로젝트 폴더에 업로드, 기존 파일 연결, 목록/열기. 기존 파일 연결은 원본 이동 없이 참조.
- ACM 연결 제거/프로젝트 보관은 Google 원본 파일을 삭제하지 않는다.
- Drive 미연결 상태에서도 프로젝트/이슈/노트 사용 가능. 문서 생성/파일 업로드에는 연결 안내.

## 3. Findings (확인 사항)
- frontend-acm / NestJS acm-* / PostgreSQL ACM_DS 및 ent_id 격리 사용.
- 확인한 ACM 소스에는 Drive 프로젝트 연동 없음. GA4 서비스계정 인증은 존재하지만 사용자 Drive OAuth로 대체 사용하지 않음.
- 2026-10-14 AMA 프로젝트 목록 화면 확인: 카드, 검색/정렬/상태/보관함 구성. 지정 문서 탭 상세 본문은 Loading 상태 지속으로 확인 불가. 화면 구성안 v1.1에 확인 사실과 ACM 설계안을 구분 기록. AMA 데이터 동기화는 포함하지 않음.
- /memories 경로 없음. IDE 작업트리에 기존 변경 다수 존재하므로 구현 시 별도 작업 디렉터리 사용.

## 4. Access and Integration (권한·연동)
- 공용 계정 연결/해제: 기존 설정 접근권한 보유 관리자. 프로젝트 관리자는 참여자 관리, 참여자는 프로젝트 내 작업 수행. 서버에서 테넌트/참여 권한 검증.
- OAuth state 일회성 검증, 서버 토큰 암호화 저장, refresh token은 서버에서만 보관; 관리자 Google Picker에 한해 단기 access token 전달, 연결 해제/만료 처리.
- 최소 drive.file 권한과 Picker 사용을 우선한다. URL만으로 접근 가능하다고 판정하지 않는다.
- ACM 참여 권한과 Google 파일 공유 권한은 별개. 기본은 Google 기존 권한 유지; 앱에서 공개 링크나 자동 권한 확대하지 않는다. Google 권한이 없으면 담당자에게 권한 요청 안내.
- 공용 계정 인증과 Google Cloud OAuth 클라이언트/승인된 리디렉션 URI 설정은 운영 연결 시 필요. 비밀키는 문서·채팅에 기록하지 않는다.

## 5. References (참조)
- https://developers.google.com/workspace/drive/api/guides/create-file
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth

## 6. Drive UX Reference (Drive 연결 UX 보완 — 2026-10-14)
사용자 요청으로 AMA /drive의 연결 폴더 카드, 검색, 폴더 탐색, 정렬/보기 전환, 새 폴더/업로드, 원본 보존 연결 해제 UI를 확인했다. 최초 OAuth UI는 확인되지 않았으며 ACM에는 계정 연결 → 저장 위치 선택 → 완료의 간편 절차를 설계한다. 공용 계정 토큰을 일반 참여자 브라우저에 배포하지 않고 서버에서 프로젝트 범위를 제한한다. 자세한 화면·권한·복구 기준은 계획서 v1.2의 1.6 참조.
