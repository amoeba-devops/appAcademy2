---
document_id: CERT-ADR-1.0.0
version: 1.0.0
status: Accepted
date: 2026-04-27
deciders: app-academy core team
related_question: Q-021 (CLAUDE.md §12)
supersedes: —
---

# ADR-003 — 공동인증서 보관 및 서명 방식 (NTS eTax)

## 1. Context (배경)

NTS Hometax eTax API에 세금계산서를 직접 전송하려면 학원의 **사업자
공동인증서**(범용 또는 전자세금용)로 XML 본문을 PKCS#7 / XMLDSig 서명해야 한다.

- 현 구현 상태: `tac_pay_tax_invoices` 테이블만 존재. 서명·전송 모듈 미구현.
- 선행 설계 문서:
  - [docs/design/academy-management-process.md](../../academy-management-process.md) §4 — "서버 HSM/KMS 에서 공동인증서로 XML 전자서명"
  - [docs/design/academy-management-func-spec.md](../../academy-management-func-spec.md) FN-106 / FN-123 — HSM/KMS slot 등록 UI 가정
  - CLAUDE.md §11-4 — "공동인증서는 HSM/KMS 보관. 코드에 하드코딩 금지"
- 멀티테넌트 SaaS 컨텍스트(v1.4.0): **테넌트(학원) 1개 = 인증서 1개 = key slot 1개**.

질문은 다음으로 좁혀진다:

> **물리 HSM 어플라이언스를 도입할 것인가, 클라우드 KMS(예: AWS KMS / GCP KMS)
>  를 사용할 것인가, 아니면 envelope-encrypted 파일 기반 절충안으로 갈 것인가?**

## 2. Decision (결정)

**v2.x까지 "AWS KMS-encrypted PFX (envelope encryption) + 메모리 내 단일
서명" 방식을 채택한다.** 물리 HSM은 도입하지 않는다.

구체:

1. 학원이 업로드한 PFX(.p12) 파일을 **AWS KMS Customer Managed Key (CMK) 로
   envelope 암호화**해 S3 (서버 측 암호화 KMS-SSE 추가) 에 보관.
2. 서명 시점에만 백엔드(NestJS)가 KMS `Decrypt` 호출 → 메모리에서 PFX 로드 →
   `node-forge` 또는 `xml-crypto` 로 서명 → **메모리 즉시 폐기** (Buffer 0-fill).
3. 서명 로그는 `tac_pay_tax_invoices.txi_signed_at`, `txi_signer_thumbprint`
   (인증서 thumbprint SHA-256) 에 기록.
4. PFX 패스프레이즈는 **별도 KMS 키로 envelope 암호화**해 DB(`tac_academy_certs.cert_passphrase_enc`)
   저장. PFX 파일과 패스프레이즈는 **다른 KMS 키 + 다른 IAM 정책**으로 보호 (이중 격리).
5. 서명 작업은 RabbitMQ `tax-invoice-sign` 큐 1개의 단일 워커 컨슈머에서만
   실행 (key 사용 흐름 단일화).

§5 트리거 충족 시 ADR-003-A 또는 ADR-004 로 HSM 전환을 재평가.

## 3. Options Considered (대안)

| # | 옵션 | 키 보관 | 서명 위치 | 비용/달 (1 테넌트) | 운영 복잡도 |
|---|------|---------|-----------|-------------------|------------|
| A | **KMS-encrypted PFX (envelope)** ✅ 선택 | S3 + KMS CMK | NestJS 메모리 | $1 (KMS) + S3 무시 | 낮음 |
| B | AWS CloudHSM | CloudHSM cluster | HSM 내부 PKCS#11 | $1,500+ (cluster) | 매우 높음 |
| C | 물리 HSM 어플라이언스 (Thales/SafeNet) | 사내 데이터센터 | 네트워크 PKCS#11 | $20k+ 초기 | 매우 높음 |
| D | 평문 PFX + 파일시스템 | EBS volume | NestJS 메모리 | $0 | 낮음 (보안 ✗) |
| E | KMS Sign API (asymmetric) | KMS CMK (RSA) | KMS 내부 서명 | $0.03/sign | 낮음 |

**옵션 E 제외 사유**: NTS는 한국 공동인증기관(KISA, 금융결제원 등) 발급 X.509
인증서를 요구함. AWS KMS 가 자체 발급한 RSA 키로 서명할 수 없음. KMS 는
**키 보관(envelope)** 으로만 사용 가능.

## 4. Rationale (근거)

### 4.1 SaaS 비용 모델 (가장 결정적)
- 옵션 B(CloudHSM): cluster 최소 2 HSM = **$3,000/월 baseline**. 테넌트당
  부담시 학원 월 결제 매출의 상당 부분을 잠식. SaaS 마진 모델 파괴.
- 옵션 C: 초기 CAPEX + 사내 데이터센터 운영 = TAC 의 클라우드 우선 운영 모델과
  배치.
- 옵션 A: KMS CMK $1/월 + 호출 단가 $0.03/10k. 1 테넌트당 사실상 무시 가능.

### 4.2 컴플라이언스
- **NTS Hometax 발급 요건**: "발급자 PC 또는 안전한 서버에 보관된 공동인증서로
  서명" — HSM 의무 아님. 「전자세금계산서 의무발행 사업자」를 위한 가이드라인은
  KMS-기반 envelope 도 안전한 보관(safekeeping) 으로 인정.
- **개인정보보호위원회 안전성 확보조치 기준** §7-3: "암호키는 별도의 안전한
  장소에 보관" — KMS CMK 가 만족.
- **PCI-DSS 적용 안 함**: 인증서는 카드 PAN 이 아님.

### 4.3 보안 위협 모델
- 가장 큰 위협 = **애플리케이션 RCE 시 키 노출**. HSM 은 PFX 자체를 외부에
  노출하지 않으므로 RCE 발생 시에도 키 추출 불가능 → 강점.
- 옵션 A 의 완화책:
  - 서명 워커를 **별도 컨테이너**로 분리 (admin/portal 컨테이너에서는 KMS
    Decrypt 권한 없음).
  - KMS Decrypt 호출에 **CloudTrail 로깅 + 알림** (분당 N회 초과 시 SIEM 경보).
  - PFX와 패스프레이즈를 **다른 KMS 키 + 다른 IAM**으로 분리(§2.4).
  - 서명 후 메모리 즉시 zeroize (`Buffer.fill(0)`).
- 잔존 리스크는 v2.x 매출 규모(예상 < $X) 에서 수용 가능.

### 4.4 멀티테넌트 운영
- 옵션 B/C 는 테넌트당 HSM slot/partition 프로비저닝이 필요 → AMA App Store
  자동 onboarding 시퀀스를 비대화.
- 옵션 A 는 학원이 PFX 를 업로드하는 즉시 S3 오브젝트 + DB row 1개로 끝.
  SUSPEND/CANCEL 이벤트 시 S3 오브젝트 + KMS grant revoke 로 격리.

### 4.5 키 만료 / 갱신
- 한국 공동인증서 유효기간 = 1년. 모든 옵션이 동일하게 갱신 UI 필요
  (FN-123 "공동인증서 등록").
- 옵션 A 는 학원 관리자 콘솔에서 PFX 재업로드 한 번으로 갱신 완료 — UX 가장
  단순.

### 4.6 단점 수용
- HSM tamper-resistance 효과 부재. 운영 정책 + KMS 호출 모니터링 + 컨테이너
  분리로 보완.
- KMS 가용성에 종속. AWS KMS SLA 99.999% 로 NTS 익월 10일 시한(NFR-013)
  대비 충분.

## 5. Reconsider Triggers (재평가 트리거)

다음 중 하나라도 충족되면 옵션 B(CloudHSM)로 재평가한다.

1. **연 매출 X 억원 돌파**: HSM CAPEX 가 매출 대비 < 0.5% 가 되어 마진 악화
   없음. (구체 임계는 재무팀과 별도 합의)
2. **외부 감사 요구 (SOC 2 Type II / ISO 27001)**: "전자서명 키는 FIPS 140-2
   Level 3 인증 HSM 에 보관" 통제 항목이 요구되는 경우.
3. **사고 발생**: KMS-encrypted PFX 키 누출 사고 또는 미수 사고 발생 시.
4. **테넌트 50개 돌파 + 평균 월 발급 100건 초과**: KMS 호출 비용이 HSM
   고정비를 역전.

## 6. Consequences (영향)

### 6.1 즉시 적용
- CLAUDE.md §12 Q-021 상태를 **Resolved (ADR-003)** 로 갱신.
- CLAUDE.md §11-4 의 "HSM/KMS 보관" 표현을 "KMS envelope 암호화 보관(ADR-003)"
  로 명확화.

### 6.2 코드 변경 (v2.x 구현 시)
- `backend/src/infrastructure/external/kms/` — KmsClient 어댑터 (`encrypt` /
  `decrypt` / `generateDataKey`). LocalStack 으로 dev 환경 모킹.
- `backend/src/modules/cert/` — 인증서 등록/조회/회전 도메인 + Use Case.
- `backend/src/modules/tax-invoice/` — 서명 워커 (RabbitMQ consumer), `xml-crypto`
  사용. 메모리 zeroize 헬퍼 포함.
- DB: `tac_academy_certs (cert_id, acd_id, cert_s3_key, cert_kms_key_id,
  cert_passphrase_enc, cert_passphrase_kms_key_id, cert_thumbprint,
  cert_subject_dn, cert_not_before, cert_not_after, cert_status)` 신규 테이블
  스펙 작성 필요 (별도 PR).

### 6.3 운영 변경
- IAM 정책 2종 신설:
  - `tac-cert-pfx-decrypt` — 서명 워커 컨테이너 전용
  - `tac-cert-passphrase-decrypt` — 서명 워커 컨테이너 전용 (별도 키)
- CloudTrail → CloudWatch Alarm: KMS Decrypt 호출 분당 임계치 초과 시 PagerDuty.
- 인증서 만료 D-30 알림은 기존 NFR-013 알림 메커니즘 재사용.

### 6.4 Open follow-ups
- ADR-003-A (가칭): 서명 워커 컨테이너 분리 토폴로지 — k8s NetworkPolicy /
  Compose 분리.
- ADR-004 후보: 옵션 E 가능성 — 한국 공인인증기관이 KMS-임포트형 키쌍을
  지원하면 재검토.

## 7. References

- CLAUDE.md §11-4 (Security Rules), §12 (Open Questions Q-021)
- [docs/design/academy-management-func-spec.md](../academy-management-func-spec.md) FN-106, FN-123
- [docs/design/academy-management-process.md](../academy-management-process.md) §4
- [ADR-001 — News 콘텐츠 저장소](ADR-001-news-storage.md)
- [ADR-002 — admin 도메인 분리](ADR-002-admin-domain-split.md)
