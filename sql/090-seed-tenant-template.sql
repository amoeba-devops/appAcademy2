-- ============================================================
-- 090 — Tenant Provisioning Seed Template
-- Document: AMA-APP-STORE-PIVOT-TASK-1.0.0
-- ------------------------------------------------------------
-- Purpose:
--   ProvisioningUseCase 가 신규 테넌트를 생성한 직후 호출하는
--   기본 데이터 시드 템플릿. (SQL 또는 use-case 코드 양쪽에서
--   사용 가능하도록 :acd_id 바인딩 변수를 사용)
--
-- Usage (ts):
--   const sql = readFileSync('sql/090-seed-tenant-template.sql', 'utf8');
--   await dataSource.query(sql, [acdId, acdId, acdId, ...]);
--   (또는 use-case 가 내용을 코드로 옮겨 transactional 실행)
--
-- Idempotency:
--   동일 acd_id 에 대해 중복 호출 시 INSERT IGNORE 로 안전.
--   (provisioning use-case 자체에서 1회 호출 보장이 우선)
--
-- Scope (Phase 1):
--   1) 기본 환불정책 v1 (학원법 시행령 제18조 3-tier)
--   2) 기본 알림 템플릿 (consultation_received / class_assigned)
--   3) 기본 운영 시간 (placeholder — onboarding wizard 에서 갱신)
--
-- Out of scope (수동 입력):
--   - 학원명, 사업자번호, slug → onboarding wizard
--   - 교사 마스터 → AMA 거래처 동기화
-- ============================================================

SET NAMES utf8mb4;

-- 바인딩 파라미터:
--   ?  = acd_id  (provisioning 직후의 신규 academy id)

-- ----------------------------------------------------------------
-- 1) 기본 환불정책 v1 (학원법 시행령 제18조)
-- ----------------------------------------------------------------
INSERT IGNORE INTO tac_pay_refund_policies
       (acd_id, rfp_version, rfp_name, rfp_basis_law, rfp_is_default,
        rfp_effective_from, rfp_created_at)
VALUES (?, 1, '기본 환불정책 (시행령 제18조)', '학원법 시행령 제18조',
        1, NOW(), NOW());

-- 위 INSERT 의 신규 ID 를 변수에 저장
SET @rfp_id := (SELECT rfp_id FROM tac_pay_refund_policies
                WHERE acd_id = ? AND rfp_version = 1
                ORDER BY rfp_id DESC LIMIT 1);

INSERT IGNORE INTO tac_pay_refund_policy_tiers
       (rfp_id, rpt_tier_no, rpt_elapsed_ratio_max, rpt_refund_ratio, rpt_label)
VALUES (@rfp_id, 1, 0.3333, 0.6667, '경과 1/3 미만 — 2/3 환불'),
       (@rfp_id, 2, 0.5000, 0.5000, '경과 1/2 미만 — 1/2 환불'),
       (@rfp_id, 3, 1.0000, 0.0000, '경과 1/2 이상 — 환불 없음');

-- ----------------------------------------------------------------
-- 2) 기본 알림 템플릿
--    (실제 컬럼은 030-migration-notification-templates 참조 —
--     컬럼이 다르면 use-case 코드에서 매핑)
-- ----------------------------------------------------------------
-- 본 SQL 은 placeholder. 실제 채움은 use-case 가 진행
-- (테이블 스키마는 030 마이그레이션에 의존하므로 컬럼 명세가
--  확정된 후 본 파일을 채운다.)

-- ----------------------------------------------------------------
-- 3) 기본 운영 시간 — placeholder
--    (학원 운영시간은 onboarding wizard step 2 에서 입력)
-- ----------------------------------------------------------------
-- (운영시간 테이블은 Phase 1 이후 별도 마이그레이션 예정)

-- ============================================================
-- End of seed template
-- ============================================================
