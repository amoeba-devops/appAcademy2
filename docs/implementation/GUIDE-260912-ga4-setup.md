---
document_id: DSH-GUIDE-260912
version: 1.0.0
status: CONFIRMED
date: 2026-09-12
depends_on: docs/plan/PLN-260912-dsh-ga4-visitor-sync.md
change_log:
  - 2026-09-12 v1.0.0 최초 작성 — fremdung@gmail.com 계정 기준 GA4·GCP·아임웹·ACM 사전 작업 순서 (Claude Code)
---

# GUIDE-260912 — GA4 방문자 연동 사전 작업 가이드 / GA4 Visitor Sync Setup Guide

> 작업 계정: **fremdung@gmail.com** (GA4 · Google Cloud 공통). 아임웹은 **trinityprep103@gmail.com** (사이트별 admin 로그인).
> 소요 시간: 약 40~60분 (GA4 15분 · GCP 15분 · 아임웹 10분 · ACM 5분 · 대기/검증 10분).
> 아래 표의 빈칸을 채워 가며 진행하면 마지막 단계(ACM 입력)에서 그대로 옮겨 적으면 된다.

## 0. Values to Collect (진행하며 채울 값)

| 항목 | 어디서 | 형식 | 값 |
|---|---|---|---|
| GA4 속성 ID | GA4 관리 › 속성 설정 › 속성 세부정보 | 숫자 9자리 (예: 512345678) | **553818421** (계정 `Trinity Academy` 407665736, 속성 `Trinity Sites`) — 2026-09-12 생성 |
| TPI 스트림 ID | GA4 관리 › 데이터 스트림 › `www.tpi.co.kr` 상세 | 숫자 10자리 | **15762037074** |
| TPI 측정 ID | 같은 화면 | `G-XXXXXXXXXX` | **G-QVDVBTC7JC** |
| TRINITY 스트림 ID | 데이터 스트림 › `trinityacademy.kr` 상세 | 숫자 | **15762045823** |
| TRINITY 측정 ID | 같은 화면 | `G-…` | **G-BM7QE6ZGSE** |
| SANTACROCE 스트림 ID | 데이터 스트림 › `santacroce.co.kr` 상세 | 숫자 | **15761907393** |
| SANTACROCE 측정 ID | 같은 화면 | `G-…` | **G-4EFHZC0077** |
| 서비스계정 이메일 | GCP IAM › 서비스 계정 | `acm-ga4@<프로젝트>.iam.gserviceaccount.com` | **acm-ga4@acm-ga4.iam.gserviceaccount.com** (GCP 프로젝트 `acm-ga4`, Data API 사용 설정 완료 2026-09-12) |
| 서비스계정 JSON 키 파일 | GCP 서비스 계정 › 키 | `*.json` 다운로드 파일 | `~/Downloads/acm-ga4-48261a572202.json` (ACM 업로드 후 삭제 예정 — 저장소에 커밋 금지) |

> **진행 현황 (2026-09-12, Claude Code 대행)**: 1절 GA4 계정/속성/스트림 3개 ✅ · 2절 GCP 프로젝트 `acm-ga4`·Data API·서비스계정·JSON 키 ✅ · 3절 속성 뷰어 권한 ✅ · 4절 아임웹 3사이트 측정 ID 연결 ✅(각 "저장에 성공했습니다") · **5절 ACM 설정 ⏸** — 운영 콘솔의 fremdung@gmail.com 계정이 테넌트 ADMIN 역할이 아니어서 `/admin/config/*` API 가 403("Failed to load the config", 카카오 설정 페이지도 동일). 테넌트 ADMIN 계정으로 로그인해 5절을 진행해야 한다.

⚠ **측정 ID(G-…)는 아임웹에, 스트림 ID(숫자)는 ACM에** 넣는다. 둘을 바꿔 넣으면 ACM 연결 테스트는 성공하지만 사이트 매핑이 안 돼 "미매핑 스트림"으로 표시된다.

## 1. GA4 — 속성 1개 + 웹 스트림 3개 만들기 (fremdung@gmail.com)

1. https://analytics.google.com 접속 → fremdung@gmail.com 로그인.
2. 왼쪽 아래 **⚙ 관리(Admin)** 클릭.
3. 계정이 없으면 **+ 만들기 › 계정** → 계정 이름 `Trinity Academy` → 데이터 공유 설정 기본값 → 다음.
   - 이미 계정이 있으면 그 계정 선택 후 **+ 만들기 › 속성**.
4. **속성 만들기**
   - 속성 이름: `Trinity Sites` (3사이트 공통 1개 속성)
   - 보고 시간대: **대한민국 (GMT+09:00)**, 통화: **대한민국 원(KRW)**
   - 비즈니스 세부정보/목표: 아무 값이나 선택 → **만들기** → 약관 동의.
5. **데이터 수집 시작 › 웹** 선택 → 첫 스트림 생성:
   - 웹사이트 URL: `https://www.tpi.co.kr`, 스트림 이름: `TPI` → **스트림 만들기**
   - 생성된 화면 상단의 **스트림 ID(숫자)** 와 **측정 ID(G-…)** 를 0절 표에 기록. ("측정 ID" 는 우측 상단, "스트림 ID" 는 그 옆 상세 정보에 있음)
6. 관리 › **데이터 스트림** → **스트림 추가 › 웹** 으로 나머지 2개 추가:
   - `https://trinityacademy.kr`, 이름 `TRINITY`
   - `https://santacroce.co.kr`, 이름 `SANTACROCE`
   - 각각 스트림 ID·측정 ID 기록.
7. 관리 › **속성 설정 › 속성 세부정보** → **속성 ID(숫자)** 기록. (URL 의 `p123456789` 숫자 부분과 동일)
8. (권장) 관리 › **데이터 설정 › 데이터 보관** → 이벤트 데이터 보관 **14개월** 로 변경.

## 2. GCP — Data API 사용 설정 + 서비스계정 키 (fremdung@gmail.com)

1. https://console.cloud.google.com 접속 → 같은 계정 로그인. 처음이면 약관 동의.
2. 상단 프로젝트 선택 ▾ → **새 프로젝트** → 이름 `acm-ga4` → 만들기 → 생성된 프로젝트 선택.
   (결제 계정 연결 **불필요** — Data API 는 무료 할당량으로 충분)
3. 왼쪽 메뉴 **API 및 서비스 › 라이브러리** → 검색 `Google Analytics Data API` → 선택 → **사용(Enable)**.
   - 검색 결과에 "Google Analytics Admin API" 도 보이지만 **Data API** 만 켜면 된다.
4. **IAM 및 관리자 › 서비스 계정** → **+ 서비스 계정 만들기**
   - 이름 `acm-ga4`, ID 자동(`acm-ga4`) → **만들고 계속하기**
   - 역할 부여 단계: **건너뛰기** (GCP 역할 불필요 — 권한은 GA4 쪽에서 준다) → **완료**
   - 목록의 이메일 `acm-ga4@acm-ga4-xxxxx.iam.gserviceaccount.com` 기록.
5. 해당 서비스 계정 클릭 → **키 탭 › 키 추가 › 새 키 만들기 › JSON › 만들기** → JSON 파일이 다운로드됨.
   - 파일은 ACM 에 업로드한 뒤 **삭제하거나 안전한 곳에 보관** (재발급 가능). 메일·채팅으로 전송 금지.
   - 조직 정책으로 키 생성이 차단되면("서비스 계정 키 생성 사용 중지") 개인 Gmail 프로젝트에서는 보통 발생하지 않음. 발생 시 IAM › 조직 정책 `iam.disableServiceAccountKeyCreation` 확인.

## 3. GA4 — 서비스계정에 속성 읽기 권한 부여

1. GA4 관리 › (속성 열) **속성 액세스 관리** → 우측 상단 **+ › 사용자 추가**.
2. 이메일 주소: 2-4 에서 기록한 서비스계정 이메일 입력, **"새 사용자에게 이메일로 알림"** 체크 해제.
3. 역할: **뷰어(Viewer)** → **추가**.
4. 목록에 서비스계정이 뷰어로 보이면 완료. (반영에 1~2분 걸릴 수 있음)

## 4. 아임웹 — 사이트별 GA4 연결 (trinityprep103@gmail.com)

3사이트 각각 반복 (TPI → TRINITY → SANTACROCE). admin 세션은 사이트마다 따로 로그인해야 한다.

1. 사이트 admin 접속: `https://tpi.imweb.me/admin`, `https://trinityacademy.imweb.me/admin`, `https://santacroce.co.kr/admin`.
2. 왼쪽 메뉴 **설정 › 마케팅 채널 연동** (`/admin/config/data-connect`).
3. "연결 가능한 데이터" 목록의 **Google 애널리틱스 › 연결**.
4. 해당 사이트의 **측정 ID(G-…)** 입력 → 저장. (Google 계정 로그인 창이 뜨면 fremdung@gmail.com 로 로그인 후 `Trinity Sites` 속성/해당 스트림 선택)
5. 연결 후 "연결된 데이터" 에 Google 애널리틱스가 표시되는지 확인. TPI 는 기존 "네이버 프리미엄 로그 분석" 이 이미 연결돼 있어도 무관(병행).
6. 확인: 시크릿 창에서 사이트를 한 번 열고, GA4 **보고서 › 실시간** 에 활성 사용자 1이 뜨면 태그 동작 OK (1~2분 내).

## 5. ACM — 설정 입력 · 연결 테스트 · 동기화

1. https://acm.amoeba.site/admin/config/ga4 접속 (ADMIN 계정).
2. 입력
   - **GA4 속성 ID**: 1-7 의 숫자
   - **사이트별 데이터 스트림 ID**: TPI / TRINITY / SANTACROCE 각 숫자 (측정 ID 아님)
   - **서비스계정 키(JSON)**: 2-5 에서 받은 JSON 파일 선택
   - 방문자 지표: **활성 사용자(activeUsers)** (기본)
   - **사용(야간 자동 수집 활성화)** 체크
3. **저장** → 화면에 "설정됨 — acm-ga4@…iam.gserviceaccount.com" 표시 확인.
4. **연결 테스트** → `연결 성공 — 최근 7일 N행, 스트림 ID: …` 가 나오면 권한·속성·키 모두 정상.
   - 태그 연결 직후라 데이터가 없으면 `0행` 이어도 성공이다(스트림 ID 목록만 비어 있음).
5. **지금 동기화(최근 7일)** → `동기화 완료 — … N행 반영 (미매핑 스트림: —)`.
   - "미매핑 스트림: 1234567890" 처럼 숫자가 나오면 그 스트림 ID 가 사이트 칸에 잘못 입력된 것 → 2번에서 수정 후 저장·재동기화.
6. 대시보드(https://acm.amoeba.site/admin/dashboard) MARKETING 카드에 `출처 GA4 · 동기화 시각` 배지와 `사이트별 TPI n · TRINITY n · SANTACROCE n` 이 보이면 완료. 이후 매일 04:00 자동 수집(D-3~D-1 재수집).

## 6. Verification & Notes (검증·유의사항)

- **수치 비교**: 연결 다음 날, 아임웹 통계 › 기간별 분석 › 일별 "방문자" 와 ACM 방문자(GA4 activeUsers)를 같은 날짜로 비교. 아임웹은 IP 기준, GA4 는 쿠키 기반 활성 사용자라 **10~30% 차이는 정상**. 광고차단 브라우저는 GA4 에 집계되지 않는다.
- **과거 데이터**: GA4 는 태그 연결 이후만 존재. 이전 기간은 대시보드 **수동 입력**(아임웹 CSV 값)으로 보완 — 수동 입력이 있는 날은 GA4 값보다 우선한다(✎ 표시).
- **지연**: GA4 일별 수치는 익일 오전에 대부분 확정되며 최대 48시간 보정 → ACM 은 매일 D-3~D-1 을 다시 받는다.
- **키 회전**: 서비스계정 키를 새로 만들면 ACM 에서 JSON 파일만 다시 선택·저장하면 된다(이전 키는 GCP 에서 삭제).
- **다른 테넌트**: 설정은 테넌트(학원)별로 저장된다. 다른 학원이 입주하면 그 학원의 GA4 속성/키를 각자 입력한다.

## 7. Troubleshooting (문제 시)

| 화면 메시지 | 원인 | 조치 |
|---|---|---|
| `GA4_SA_KEY_INVALID_JSON` / `…MISSING_FIELDS` | JSON 파일이 아니거나 서비스계정 키가 아님(OAuth 클라이언트 JSON 등) | 2-5 에서 **서비스 계정 › 키 › JSON** 으로 다시 발급 |
| `GA4_TOKEN_FAILED 400 invalid_grant` | 키가 삭제됐거나 시계 오차 | GCP 에서 키 상태 확인, 새 키 발급 |
| `GA4_REPORT_FAILED 403 … PERMISSION_DENIED` | 서비스계정이 속성 뷰어가 아님, 또는 Data API 미사용 | 3절(뷰어 추가), 2-3(Data API 사용) 확인 후 1~2분 뒤 재시도 |
| `GA4_REPORT_FAILED 404` / `400 … property` | 속성 ID 오타(측정 ID 나 계정 ID 를 넣음) | 1-7 의 숫자 속성 ID 로 수정 |
| 연결 성공인데 `미매핑 스트림: N` | 스트림 ID 칸에 측정 ID 를 넣었거나 사이트 순서 바뀜 | 데이터 스트림 상세의 **숫자 스트림 ID** 로 교체 |
| 연결 성공 `0행` 이 계속됨 | 아임웹에 측정 ID 미연결 또는 오타 | 4절 재확인, GA4 실시간 보고서로 태그 동작 확인 |
| 대시보드 방문자가 비어 있음 | 동기화 전이거나 해당 날짜에 수동 입력이 있음 | "GA4 동기화" 버튼(현재 기간) 실행, 셀 툴팁 확인 |
| `GA4_CONFIG_NOT_SET` | 속성 ID·스트림·키 중 하나 미입력 또는 비활성 | 5-2 항목 채우고 "사용" 체크 후 저장 |
