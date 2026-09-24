---
document_id: ACM-ADS-COST-SYNC-RPT-1.0.0
version: 1.0.0
status: Tested
change_log:
  - version: 1.0.0
    date: 2026-09-24
    description: 광고매체 설정·수집·보정 구현 및 로컬 검증
---
# Advertising Cost Sync Report (광고비 자동 연동 구현 보고서)

## 1. Result (구현 결과)
- `/admin/config/ad-platforms`: Meta, Google Ads, Naver Search, Naver GFA 계정 등록, 암호화 자격증명, 사이트/캠페인 배정, 연결 테스트, 활성화·중지·연결 해제, 수집 이력 및 최대 31일 재수집.
- Meta Insights, Google Ads GAQL, Naver Search 통계 어댑터. GFA는 공식 파트너 API 접근·사양 확보 전 등록만 가능하며 테스트/활성화 제한.
- Google OAuth state는 tenant·사용자·계정 revision에 결합, 10분 만료 및 일회성 소비. 토큰은 기존 AES-GCM 유틸리티로 암호화하고 응답·감사에서 제외.
- 매일 08:00 KST 이후 최근 7개 완료 일자를 자동 예약. 분 단위 복구 스케줄이 당일 누락 예약을 보완. DB 고유키·계정 잠금·lease/fencing으로 중복 커밋 차단.
- 원본, 가감/고정 보정, 수기 광고비를 별도 보존. 대시보드 일별 입력창에서 원본·보정 후 금액·계정별 수집 상태·보정 이력을 확인.
- 수기 중복은 날짜·사이트 전체를 대상으로 ADD/REPLACE 명시 선택. 기존 자유입력 매체명을 자동 매체 코드로 추정하지 않음. 양수 공통 비용이 있으면 사이트별 분리 전 자동 적용 보류.
- 통합·사이트 집계는 기존 marketing resolver를 통해 동일하게 적용. GA 원본/방문자 보정/학생·교사·CS·수업 집계 경로는 변경하지 않음.

## 2. Verification (검증)
- Backend build: PASS.
- Frontend build: PASS (기존 대형 번들 경고 유지).
- 신규 광고 코드 ESLint: 오류/경고 0.
- 전체 단위 테스트: **78 suites / 618 tests PASS**.
- PostgreSQL 광고 수집 및 기존 마케팅 회귀: **2 suites / 25 tests PASS**.
- 주요 검증: 비밀값 암호화·비노출, tenant 격리, OAuth 다른 tenant 거부/일회성 소비, 설정 변경 중 테스트 차단, 미검증 활성화 거부, 중복 수집/동시 worker, 연결 해제 중 오래된 커밋 차단, 실패 시 원본 유지, DELTA/FIXED 재수집 보존, 수기 비용 보존, 완결된 0원 응답, KRW/KST 검증, 적용일별 사이트 배정 유지, 3개 사이트 합계=통합.
- 실제 광고계정 인증정보가 제공되지 않아 **실계정 API·청구서 대사·실제 일일 실행은 미검증**. 연결 완료 또는 자동 수집 가동으로 보고하지 않음.

## 3. Operating Procedure (운영 절차)
1. 설정 > 광고매체 연동에서 계정과 연결 정보를 저장. 모든 신규 계정은 중지 상태.
2. Google Cloud OAuth 웹 클라이언트 승인 리디렉션 URI: `https://acm.amoeba.site/admin/config/ad-platforms`. 서버는 `ADS_GOOGLE_REDIRECT_URI` 또는 `FRONTEND_URL` 기준 동일 경로를 사용. 개발 환경은 별도 HTTPS 리디렉션 설정 필요.
3. 계정 전체 기본 사이트 또는 캠페인별 사이트 지정. 캠페인별 지정이 기본 사이트보다 우선하며 중복 합산하지 않음.
4. 연동 테스트의 KRW/KST·미배정·읽기 보고서 결과를 확인한 뒤 활성화.
5. 과거 자료는 수집 이력의 기간 재수집으로 최대 31일씩 요청. 당일 미확정 데이터는 제외.
6. 대시보드에서 수기 비용 중복 및 공통 비용을 해결하고 필요하면 사유를 입력하여 가감/고정 보정.
7. 이후 실제 일일 수집과 매체 보고서/청구서 차이를 운영자가 확인. 금액은 매체 보고서 기준이며 서로 다른 세금 포함 기준을 임의 통일하지 않음.

## 4. Implementation Decisions and Limits (구현 결정·제한)
- 계획의 별도 mapping API 대신 계정 설정 저장에 적용일 이력을 포함. 수집 이력이 있으면 오늘 이전의 배정 변경은 차단하며 과거 재배정은 별도 검토 필요. 과거 재수집은 해당 날짜의 배정을 사용.
- 계정별 요청 기간 전체 응답을 검증한 후 원자적으로 교체. 일부 요청 실패 시 그 실행 전체를 실패로 두고 기존 성공 자료를 보존.
- Meta는 동기 Insights 페이지 조회(최대 200페이지), Google Search 페이지 조회(최대 200페이지), Naver 캠페인 페이지 조회(최대 500개)와 일별 통계를 사용. Meta 대용량 비동기 보고서 작업은 미포함이며 제한 초과는 실패로 표시하고 기간을 나눠 재시도.
- Naver에서 기존 비용이 있던 캠페인이 목록에서 사라지면 `CAMPAIGN_HISTORY_MISSING`으로 보존하고 확인 필요. 삭제된 캠페인의 처음 과거 수집은 공식 대용량 보고서와 대사가 추가로 필요할 수 있음.
- 7일보다 오래 중단된 구간은 기간 재수집으로 보완. 최초 설정일부터 전체 기간을 자동으로 무제한 소급하지 않음.
- 운영자 보정 감사와 설정/수집 감사 저장. 광고비 보정 권한은 기존 마케팅 입력과 동일한 JWT/tenant guard, 설정·연결은 ADMIN guard.
- GFA 어댑터는 접근 제한을 명시적으로 반환. 공식 파트너 문서·권한 없이는 호출 주소나 인증방식을 추정하지 않음.

## 5. Schema and Deployment (스키마·배포)
- Additive migration: `sql/acm/1020-ad-platform-cost-sync.sql`.
- 테이블: connection, mapping, run, daily_spend, day_coverage, adjustment, cost_policy, audit, oauth_state.
- 활성 계정 등록 전 자동 외부 호출 없음. 배포 후 기능 화면 및 비활성 상태를 검증할 예정.
- 롤백 시 먼저 계정 수집을 중지. 원본·보정 보존. 자동 비용이 발생한 이후 구버전 resolver로 단순 복귀하면 표시에서 빠지므로 호환 수정 버전으로 복구.

## 6. Official References (공식 참조)
- [Google Ads developer token 정책](https://developers.google.com/google-ads/api/docs/api-policy/developer-token): Cloud 프로젝트 기반 접근 전환에 따라 developer token 필수 입력 제외.
- [Google Ads API 버전 일정](https://developers.google.com/google-ads/api/docs/sunset-dates): 기본 v25.
- [Meta 공식 SDK API 버전](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/apiconfig.py): 기본 v26.0.
- [Naver 공식 통계 명세](https://github.com/naver/searchad-apidoc/blob/gh-pages/assets/json/ncc-report.json): KST 일자, `/stats` salesAmt.
- [Naver 공식 캠페인 명세](https://github.com/naver/searchad-apidoc/blob/gh-pages/assets/json/ncc-heroes-ncc.json): baseSearchId/recordSize/selector 페이지 조회.
