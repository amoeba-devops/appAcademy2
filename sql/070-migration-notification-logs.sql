-- Notification Logs (알림 발송 이력) + 추가 시드 템플릿
-- Migration: P0-3 / 2026-04-27
-- See docs/implementation/tasks/AMOEBATALK-NOTIFY-TASK-1.0.0.md §4

CREATE TABLE IF NOT EXISTS tac_notification_logs (
    nlg_id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    acd_id              BIGINT UNSIGNED NOT NULL,
    nlg_event           VARCHAR(50)     NOT NULL,
    nlg_template_id     BIGINT UNSIGNED NULL,
    nlg_channel         VARCHAR(20)     NOT NULL DEFAULT 'TALK',
    nlg_recipient       VARCHAR(40)     NOT NULL COMMENT 'Phone (masked in views)',
    nlg_recipient_kind  VARCHAR(20)     NOT NULL DEFAULT 'PARENT',
    nlg_subject_id      BIGINT UNSIGNED NULL COMMENT 'Domain entity id',
    nlg_subject_kind    VARCHAR(30)     NULL,
    nlg_body            TEXT            NOT NULL COMMENT 'Rendered body sent to AmoebaTalk',
    nlg_variables       JSON            NULL,
    nlg_status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING|SENT|FAILED|RETRYING',
    nlg_provider_msg_id VARCHAR(100)    NULL,
    nlg_error_code      VARCHAR(50)     NULL,
    nlg_error_message   VARCHAR(500)    NULL,
    nlg_attempts        INT UNSIGNED    NOT NULL DEFAULT 0,
    nlg_sent_at         DATETIME        NULL,
    nlg_created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nlg_updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tac_nlg_academy_event (acd_id, nlg_event, nlg_created_at),
    INDEX idx_tac_nlg_status (nlg_status, nlg_created_at),
    INDEX idx_tac_nlg_subject (nlg_subject_kind, nlg_subject_id),
    CONSTRAINT fk_tac_nlg_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id),
    CONSTRAINT fk_tac_nlg_template FOREIGN KEY (nlg_template_id) REFERENCES tac_notification_templates(ntf_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Additional default templates for refund / tax invoice
INSERT INTO tac_notification_templates (acd_id, ntf_event, ntf_channel, ntf_title, ntf_body, ntf_variables) VALUES
(1, 'REFUND_DONE', 'TALK', '환불 완료 안내', '{{studentName}} 학생 {{programName}} 수강료 {{amount}}원 환불이 완료되었습니다.\n주문번호: {{orderNumber}}', '["studentName","programName","amount","orderNumber"]'),
(1, 'TAX_INVOICE_APPROVED', 'TALK', '세금계산서 발행 완료', '{{buyerName}}님 세금계산서가 국세청에 정상 승인되었습니다.\n공급가액: {{supplyAmount}}원\n승인번호: {{ntsApprovalNumber}}', '["buyerName","supplyAmount","ntsApprovalNumber"]');
