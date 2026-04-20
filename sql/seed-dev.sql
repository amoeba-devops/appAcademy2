-- =============================================================
-- Trinity Academy — Development Seed Data
-- 개발 환경용 기본 데이터 (Academy + Admin User + 환불정책 v1)
-- Usage: docker exec -i tac-mysql mysql -uroot -ppassword db_tac < sql/seed-dev.sql
-- =============================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 1. Academy (학원 기본 정보)
INSERT INTO tac_academies (
    acd_name, acd_business_registration_no, acd_status
) VALUES (
    'Trinity Academy',
    '123-45-67890',
    'ACTIVE'
) ON DUPLICATE KEY UPDATE acd_name = VALUES(acd_name);

SET @academy_id = LAST_INSERT_ID();

-- 2. Admin User (원장 계정)
--    email: admin@trinityacademy.kr / password: admin1234
INSERT INTO tac_users (
    acd_id, usr_email, usr_password, usr_name, usr_role, usr_status
) VALUES (
    @academy_id,
    'admin@trinityacademy.kr',
    '$2b$10$jqFudBx4XwshJ5tp/NiwE.ERdABEtTJ6bhCqbTF7.AEcE2A2S1f9G',
    '김원장',
    'MASTER',
    'ACTIVE'
) ON DUPLICATE KEY UPDATE usr_name = VALUES(usr_name);

-- 3. Refund Policy v1 (학원법 제18조 기준 환불정책)
INSERT INTO tac_pay_refund_policies (
    acd_id, rfp_version, rfp_basis, rfp_label, rfp_effective_from, rfp_is_default_template
) VALUES (
    @academy_id,
    1,
    'SESSION',
    '학원법 §18 기본 환불정책 v1',
    '2026-01-01',
    1
) ON DUPLICATE KEY UPDATE rfp_label = VALUES(rfp_label);

SET @policy_id = LAST_INSERT_ID();

-- 4. Refund Policy Tiers (환불 구간)
--    학원법 시행령 별표4 기준:
--    - 수강개시 전: 이미 납부한 수강료 전액
--    - 총 수업시간 1/3 경과 전: 이미 납부한 수강료의 2/3
--    - 총 수업시간 1/2 경과 전: 이미 납부한 수강료의 1/2
--    - 총 수업시간 1/2 경과 후: 반환하지 아니함
INSERT INTO tac_pay_refund_policy_tiers (
    rfp_id, rpt_tier_order, rpt_elapsed_ratio_min, rpt_elapsed_ratio_max, rpt_refund_rate, rpt_note
) VALUES
    (@policy_id, 1, 0.0000, 0.0001, 1.0000, '수강 개시 전 — 전액 환불'),
    (@policy_id, 2, 0.0001, 0.3333, 0.6667, '1/3 경과 전 — 2/3 환불'),
    (@policy_id, 3, 0.3334, 0.5000, 0.5000, '1/2 경과 전 — 1/2 환불'),
    (@policy_id, 4, 0.5001, 1.0000, 0.0000, '1/2 경과 후 — 환불 불가')
ON DUPLICATE KEY UPDATE rpt_note = VALUES(rpt_note);

SELECT '✅ Seed data inserted successfully' AS result;
SELECT CONCAT('  Academy ID: ', @academy_id) AS info;
SELECT CONCAT('  Refund Policy ID: ', @policy_id) AS info;
