---
document_id: ACM-PROD-SERVER-MIGRATION-REQ-1.0.0
version: 1.0.0
status: Draft
created: 2026-10-17
change_log:
  - version: 1.0.0
    date: 2026-10-17
    description: Move production from shared host 211.110.140.172 to dedicated 175.126.232.175 / 프로덕션 서버 이전 요구사항
---
# Production Server Migration Requirements (프로덕션 서버 이전 요구사항)

## 1. Overview (개요)

프로덕션(`https://acm.amoeba.site`)을 현재 **공유 호스트 211.110.140.172**(메일서버·다른 프로젝트 스택과 함께 사용)에서
**전용 서버 175.126.232.175**(cafe24 `qm381-0103`)로 옮긴다. 새 서버에 운영 환경을 먼저 갖춘 뒤 데이터를 옮기고 도메인을 전환한다.

요청 원문: "현재 프로덕션서버를 175.126.232.175 로 이전하려고 한다. 175.126.232.175 에 먼저 필요한 운영환경을 세팅한다. root 로그인 후 appacademy 계정을 생성한다"

## 2. Current vs Target (현재·목표)

| 항목 | 현재 (211.110.140.172) | 목표 (175.126.232.175) |
| --- | --- | --- |
| 호스트 | 공유(메일서버 amb-stalwart, sharptalk·btbz·ksr) | ACM 전용 |
| OS | Ubuntu 22.04.5 | Ubuntu 22.04.5 |
| CPU / RAM | 4 / 31 GiB(공유) | 4 / 15 GiB(전용) |
| 디스크 | `/` 229G (62% 사용, 공유) | `/` 224G(3%) + **`/backup` 931G** |
| 런타임 | Docker + 호스트 nginx + certbot | (설치 예정) |
| 계정 | appacademy(sudo 비밀번호, env 의 `SUDO_PASS` 사용) | appacademy(2026-10-17 생성, 키 전용, sudo 없음) |
| DB 자동 백업 | **없음**(7월부터 cron 실패) | `/backup` 일일 백업 |

데이터 규모(2026-10-17): PostgreSQL `db_acm` 59 MB(테이블 167), MinIO 첨부 740 MB, 업로드 디렉터리 거의 없음.
도메인 `amoeba.site` DNS 는 GoDaddy(`ns27/28.domaincontrol.com`), `acm.amoeba.site` A 레코드 TTL 600초.

## 3. Functional Requirements (기능 요구사항)

| ID | 요구사항 |
| --- | --- |
| FR-1 | 새 서버에 `appacademy` 계정을 만든다(키 로그인 전용) — **완료 2026-10-17** |
| FR-2 | 서버 보안 기본값: 비밀번호 SSH 로그인 차단, root 는 키로만, 방화벽 22·80·443 만 허용, 보안 업데이트 자동 적용 |
| FR-3 | 운영 런타임 설치: Docker Engine + Compose v2, 호스트 nginx, certbot(webroot 갱신), 로그 디렉터리 |
| FR-4 | 배포에 필요한 최소 권한: appacademy 는 docker 그룹 + 배포 스크립트가 쓰는 명령만 비밀번호 없는 sudo(nginx 설정 반영·reload, 업로드 폴더 권한). env 의 `SUDO_PASS` 는 새 서버에서 쓰지 않는다 |
| FR-5 | 앱 준비: 저장소 체크아웃, `.env.production` 이전(값은 화면·로그에 남기지 않음), DB 이미지 빌드, 앱 이미지 pull(GHCR 공개 — 인증 불필요 확인) |
| FR-6 | 데이터 이전: `db_acm` 전체, MinIO 데이터, 마이그레이션 적용 기록(`sql/_applied/acm`) — 이전 후 건수 일치 확인 |
| FR-7 | 자동 백업: PostgreSQL 일일 덤프 + MinIO 데이터, `/backup` 에 30일 보관, 실패 시 로그. 현재 서버의 끊긴 백업도 같은 스크립트로 복구 |
| FR-8 | 도메인 전환: `acm.amoeba.site` A 레코드 → 175.126.232.175. 전환 중 점검 시간 최소화(목표 30분 이내) |
| FR-9 | TLS: 전환 직후 새 서버에서 `acm.amoeba.site` 인증서 발급·자동 갱신 |
| FR-10 | 배포 파이프라인: `cd-production.yml` 이 새 서버로 배포(GitHub `production` Environment 의 SSH 비밀 교체) |
| FR-11 | 되돌리기: 전환 실패 시 DNS 를 원래 IP 로 되돌려 현재 서버로 복귀. 현재 서버는 전환 후 일정 기간 그대로 보존 |

## 4. Non-Functional (비기능)

- 다운타임: 쓰기 중단(점검) 30분 이내, DNS 전파(TTL 300 으로 사전 단축) 포함 1시간 이내.
- 데이터 손실 0: 점검 시작 후 최종 덤프 → 복원 → 건수 대조.
- 비밀값은 문서·채팅·로그에 남기지 않는다(파일 간 직접 복사).
- 현재 서버의 다른 서비스(메일서버 등)는 건드리지 않는다.

## 5. External Dependencies (외부 연동 영향)

| 연동 | 방식 | 이전 영향 |
| --- | --- | --- |
| 아임웹 3사이트 상담 접수 | 도메인 호출 | 없음(도메인 유지) |
| AMA SSO·알림·웹훅 | 도메인 호출 / ACM→AMA 아웃바운드 | AMA 가 ACM 출발 IP 를 허용 목록으로 관리하는지 **확인 필요** |
| 보다스쿨(화상) | ACM→벤더 API + 벤더→ACM 웹훅(벤더 IP 검증) | 벤더가 ACM 출발 IP 를 허용 목록으로 관리하는지 **확인 필요** |
| Gmail SMTP | 아웃바운드 587 | 없음 |
| Google OAuth·Drive·GA4 | 도메인 리다이렉트 / 아웃바운드 | 없음 |
| 웹 푸시 | 아웃바운드 | 없음 |

## 6. Open Questions (확인 사항)

| Q | 내용 | 제안 |
| --- | --- | --- |
| Q1 | GoDaddy DNS 변경은 누가 하나? | 사용자(또는 담당자)가 전환 시각에 A 레코드 변경. 하루 전 TTL 300 으로 낮춤 |
| Q2 | 전환 시각 | 이용이 적은 평일 밤 또는 주말 오전(점검 30분) |
| Q3 | 현재 서버 보존 기간 | 전환 후 14일 동안 컨테이너 정지 상태로 보존, 이후 정리 |
| Q4 | 보다스쿨·AMA 에 출발 IP 허용 목록이 있는가? | 전환 전 문의, 있으면 새 IP 추가 요청 |
| Q5 | GitHub `production` 비밀 교체 | 저장소 관리자 권한 필요 — 사용자(amoeba-devops) 작업 |
| Q6 | 스왑 4GB 추가(메모리 15GB 여유 확보용) | 추가 권장 |
