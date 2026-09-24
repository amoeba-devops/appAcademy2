---
document_id: ACM-ADS-COST-SYNC-REQ-1.0.0
version: 1.0.0
status: Implemented
change_log:
  - version: 1.0.0
    date: 2026-09-24
    description: 광고매체 연동·사이트별 일일 광고비 수집·운영자 보정 요구사항 정의
---
# Advertising Cost Integration Requirements (광고비 자동 연동 요구사항)

## 1. Scope and Baseline (범위·현재 구현)
메타광고, 구글광고, 네이버 광고의 실제 집행비용을 매일 1회 수집해 TPI/TA/SC 사용광고비에 반영한다. 설정에서 사용하는 매체·계정을 등록하고 인증정보, 사이트 연결, 연동 테스트, 수집 상태를 관리한다. 운영자는 수집값을 보정할 수 있어야 한다.

현재 배포 기준은 PR #283, `92af8b906caf31e3819a931aa35c3ea364047cd8`이다. 사용자 작업 디렉터리는 이전 브랜치와 미커밋 문서를 포함하므로 구현 시 최신 main의 격리 작업 공간을 사용한다.

| 현재 구조 | 확인 내용 | 변경 방향 |
|---|---|---|
| `frontend-acm/src/modules/cfg/pages/config-landing-page.tsx` | 연동별 설정 카드 | 광고매체 연동 카드 추가 |
| `acm-system` GA4 설정 | ADMIN 권한·암호화 키·테스트 패턴 | 광고매체 전용 설정으로 확장, GA4 자격증명과 구분 |
| `ga4-sync.job.ts` | Nest Schedule, 04:00 Asia/Seoul | 광고비는 독립 작업으로 분리 |
| `marketing-input.service.ts` | 사이트별 수기 광고 행, 날짜 revision, 감사 이력 | 자동 원본과 수기 보정 분리 |
| `marketing-resolver.ts` | 일별·요약·비교에 광고비 공통 적용 | 자동 집행비 + 보정 + 별도 수기 비용 합산 |
| `1019-dsh-marketing-adjustments.sql` | 수기 광고비·날짜 정책 테이블 | 기존 행 보존, 자동 수집 테이블 추가 |

`SPEC.md`, `docs/standard/SPEC.md`, 기존 대시보드 설계와 9/23 작업계획·보고서를 참조했다. `/memories`, `/memories/session`, `/memories/repo`는 현재 환경에서 확인되지 않았다. 초기 대시보드 설계는 현재 구현보다 오래되어 실제 소스를 우선한다.

## 2. Provider Feasibility (매체별 공식 자료 확인)
확인일: 2026-09-24. 공식 문서/공식 SDK 근거이며 실제 광고계정 자격증명으로 호출한 결과는 아니다.

| 매체 | 수집 경로·필드 | 연동 설정·제약 |
|---|---|---|
| Meta | Marketing API Insights, 일별 캠페인 `spend`, 계정 통화 | 광고 계정 ID·접근 토큰, 앱/시스템 사용자 등 적합한 운영 인증 방식. 읽기 권한 및 대상 광고계정 접근 확인 필요 |
| Google Ads | Google Ads API, `segments.date`, `campaign.id`, `metrics.cost_micros` | OAuth 연결·Customer ID·필요 시 관리자 계정 ID, Cloud 프로젝트의 운영 API 접근 승인 확인. `cost_micros / 1,000,000`을 계정 통화 단위로 변환 |
| Naver Search Ads | 검색광고 API `/stats` 등 일별 비용 `salesAmt` | Customer ID·API License·Secret Key, 서명 인증. 현재 사용 광고 상품과 통계 범위 확인 |
| Naver Display/GFA | 검색광고와 별도 API | 공식 안내상 공식 파트너사 제공 조건이 있어 권한·문서 확보 여부 확인 후 해당 어댑터 확정. 검색광고 키로 GFA까지 된다고 표시하지 않음 |

### Evidence (근거)
- [Meta 공식 Insights SDK](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py), [AdAccount SDK](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py): Insights 및 비용/계정 필드 확인. Meta 개발자 Insights 페이지는 이번 열람에서 오류가 있어 정확한 앱 심사·권한 요건은 구현 착수 시 공식 콘솔/문서에서 추가 확인한다.
- [Google 비용 필드](https://developers.google.com/google-ads/api/fields/v22/metrics), [OAuth](https://developers.google.com/google-ads/api/docs/oauth/overview), [Developer token 전환 안내](https://developers.google.com/google-ads/api/docs/api-policy/developer-token): 전환 안내는 2026-09-09부터 개발자 토큰 대신 Cloud 프로젝트 기준 접근 관리를 설명한다. 다른 OAuth/REST 문서에는 이전 필수 토큰 안내가 남아 있어, 신규 화면에 개발자 토큰을 무조건 필수로 만들지 않고 구현 버전·실제 계정 테스트로 확인한다.
- [네이버 공식 API 샘플](https://github.com/naver/searchad-apidoc/blob/master/python-sample/examples/ad_management_sample.py), [API 발급 안내](https://github.com/naver/searchad-apidoc), [통계 필드 설명](https://naver.github.io/searchad-apidoc/release/2016/10/17/release-note/): 인증 헤더와 비용 조회 경로 확인. 비용의 VAT 기준은 사용 보고서와 운영 화면을 대조해 확정한다.
- [네이버 통합 플랫폼 공지](https://ads.naver.com/notice/30303?page=4&searchValue=%EC%B6%94%EC%B2%9C): 검색/디스플레이 API는 플랫폼 통합 후에도 분리 운영. [공식 도움말](https://ads.naver.com/help/search?categoryNo=960&searchType=TAG&searchValue=%25EB%2594%2594%25EC%258A%25A4%25ED%2594%258C%25EB%25A0%2588%25EC%259D%25B4%25EA%25B4%2591%25EA%25B3%25A0): 디스플레이 API는 공식 파트너사 제공 안내.

## 3. Functional Requirements (기능 요구사항)
| ID | 요구사항 | 완료 조건 |
|---|---|---|
| FR-01 | 설정 > 광고매체 연동 `/admin/config/ad-platforms` | 매체·계정별 등록/수정/일시중지/연결해제, 동일 매체 복수 계정 지원 |
| FR-02 | 연결정보 설정 | 매체별 필드, 비밀값 마스킹, 빈 입력은 기존값 유지, 명시적 교체/삭제 구분 |
| FR-03 | 읽기 전용 연동 테스트 | 인증→계정 접근→통계 조회→통화/시간대→매핑 검사 결과를 단계별 표시. 비용 저장·광고 생성·집행 변경 없음 |
| FR-04 | 사이트 연결 | 계정 전체를 한 사이트에 연결하거나 캠페인 ID별 TPI/TA/SC 연결. 같은 원본을 여러 사이트에 중복 배정하지 않음 |
| FR-05 | 자동 수집 | 매일 1회, 기본 08:00 KST에 전일 및 최근 7일 재조회(제안). 지연 정정 반영, 재시도는 동일 배치의 복구로 기록 |
| FR-06 | 운영자 보정 | 자동 수집 원본 읽기 전용, ±보정 또는 고정 최종금액 선택, 사유·작성자·변경 전후 이력 필수 |
| FR-07 | 사용광고비 반영 | 일별/사이트/통합/요약/비교/CSV에 같은 산식. 출처, 원본, 보정, 반영액 표시 |
| FR-08 | 운영 상태 | 최종 성공시각·데이터 기준일·다음 실행·오류·누락 캠페인·미수집·실제 0을 구분 |
| FR-09 | 수동 복구 | 지금 수집, 실패 재시도, 기간 지정 재수집. 기간·호출량 제한 및 중복 실행 방지 |
| FR-10 | 과거 수기값 보호 | 연동 시작일과 기존 비용 충돌 확인 후 적용. 이름이 같은 수기 행을 자동 매칭·삭제하지 않음 |

## 4. Calculation and Data Rules (계산·데이터 규칙)
- 매체별 자동 비용 A, 보정액 D: 기본 반영액 = A + D. 재수집으로 A가 달라져도 D는 유지한다. 최종액 음수는 허용하지 않는다.
- 고정 최종금액 F 선택 시 반영액 = F. 원본 A는 계속 갱신·표시한다. 원본 복귀로 F/D를 명시적으로 해제할 수 있다. 두 모드는 동시에 적용하지 않는다.
- 사이트 사용광고비 = 해당 사이트에 배정된 자동 매체 반영액 합 + 별도 수기 광고비. 동일 비용을 수기와 자동에 중복 포함하지 않는다.
- 통합 비용 = TPI + TA + SC + 명시적 공통 비용. 미배정 캠페인은 자동으로 공통에 넣지 않고 ‘미분류 비용’에 분리, 완전 집계가 아님을 표시한다.
- 계정 전체 합계와 캠페인별 합계를 동시에 더하지 않는다. 원천 집계 단위를 일별 캠페인으로 통일하고 계정 보고서는 대사 용도로만 사용한다.
- 연결정보 재등록/토큰 교체로 같은 실제 계정이 중복 집계되지 않도록 tenant/provider/account/day/campaign/report-grain 고유 키를 사용한다.
- 원본 통화·정밀도·보고서 시간대·세금 기준을 보존한다. 초기 KRW·Asia/Seoul 계정 자동 반영을 기본안으로 하며 다른 통화/시간대는 변환 정책 승인 전 보류한다. 일별 합계를 단순 날짜 이동해 KST로 바꾸지 않는다.
- API 보고 집행비이며 청구서·VAT·크레딧·대행수수료를 포함한 결제액과 동일하다고 표시하지 않는다. 플랫폼별 비용 기준을 툴팁에 표시하고 임의 VAT 가산/차감·환산을 하지 않는다.
- 원 단위 화면은 소수 원본을 보존한 상태에서 사이트·날짜 합산 후 일관되게 반올림한다. 통합 표시액은 표시된 사이트/공통액의 합으로 맞춘다. JS 부동소수점으로 금액을 누적하지 않는다.
- API 오류·불완전 페이지·권한 제한·미배정은 0이 아니다. 전체 응답 및 범위 확인이 완료된 무집행 일자만 0으로 기록한다.
- 비활성화/연결해제는 앞으로의 수집만 중단하고 기존 원본·보정·이력은 보존한다. 캠페인 연결 변경은 적용 시작일을 갖고, 과거 재배분은 별도 미리보기/확인 절차를 거친다.

## 5. Open Dependencies (확인·준비 사항)
1. **사용자 확인 완료: 네이버 검색광고와 GFA 모두 사용한다. 두 유형 모두 구현 범위다.** GFA 파트너 API 이용 권한·문서 확보는 실연동 의존사항이며, 미확보 시 검색광고만으로 네이버 전체 연동 완료를 선언하지 않는다.
2. 매체별 실제 계정 목록과 TPI/TA/SC 배정: 하나의 계정에 여러 사이트가 있으면 캠페인별 매핑 필요.
3. 실제 자동 수집 활성화에는 운영자가 설정 화면에서 유효한 자격증명 또는 OAuth 연결을 제공해야 한다. 문서·채팅에 토큰을 적지 않는다.
4. 기본 08:00 KST·최근 7일 재수집·KRW/KST 계정 범위는 제안값이며 계정 테스트 후 확정한다.

## 6. Approval Boundary (구현 전 확인)
신규 요구사항이므로 AGENTS.md §9.2에 따라 본 분석서와 화면 구성도가 포함된 작업계획서 확인 후 구현한다. 이번 단계에서는 소스/운영 데이터/광고계정 설정을 변경하지 않는다.

## Implementation Reference (구현 참조)

2026-09-24 사용자 “구현” 승인에 따라 작업. 검증 결과, 최종 API/스키마 및 적용 제한은 [구현 보고서](../report/RPT-260924-ad-platform-cost-sync.md)에 기록한다. GFA 실연동은 공식 권한·사양 확보 전까지 미연결 상태다.
