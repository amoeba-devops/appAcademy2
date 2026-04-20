-- Notification Templates (알림 템플릿)
-- Migration: 5-4-A

CREATE TABLE IF NOT EXISTS tac_notification_templates (
    ntf_id          BIGINT          AUTO_INCREMENT PRIMARY KEY,
    acd_id          BIGINT          NOT NULL DEFAULT 1,
    ntf_event       VARCHAR(50)     NOT NULL COMMENT 'Event trigger: ENROLLMENT_CONFIRMED, PAYMENT_DONE, MAP_SCORE, CLASS_ABSENT, CONSULTATION_RECEIVED',
    ntf_channel     VARCHAR(20)     NOT NULL DEFAULT 'TALK' COMMENT 'Channel: TALK, SMS, EMAIL',
    ntf_title       VARCHAR(200)    NOT NULL,
    ntf_body        TEXT            NOT NULL COMMENT 'Template body with {{variables}}',
    ntf_variables   JSON            NULL COMMENT 'Available variable list: ["studentName","programName",...]',
    ntf_is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    ntf_created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ntf_updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ntf_deleted_at  DATETIME        NULL,

    INDEX idx_tac_ntf_academy_event (acd_id, ntf_event),
    CONSTRAINT fk_tac_ntf_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default templates
INSERT INTO tac_notification_templates (acd_id, ntf_event, ntf_channel, ntf_title, ntf_body, ntf_variables) VALUES
(1, 'ENROLLMENT_CONFIRMED', 'TALK', '수강 등록 완료', '{{studentName}} 학생의 {{programName}} 수강 등록이 완료되었습니다.\n시작일: {{startDate}}', '["studentName","programName","startDate"]'),
(1, 'PAYMENT_DONE', 'TALK', '결제 완료 안내', '{{studentName}} 학생 {{programName}} 수강료 {{amount}}원 결제가 완료되었습니다.\n주문번호: {{orderNumber}}', '["studentName","programName","amount","orderNumber"]'),
(1, 'MAP_SCORE', 'TALK', 'MAP 성적 통보', '{{studentName}} 학생의 MAP 시험 결과가 등록되었습니다.\nRIT: {{rit}} / 상위 {{percentile}}%', '["studentName","rit","percentile"]'),
(1, 'CLASS_ABSENT', 'TALK', '결석 알림', '{{studentName}} 학생이 {{date}} {{className}} 수업에 결석하였습니다.', '["studentName","date","className"]'),
(1, 'CONSULTATION_RECEIVED', 'TALK', '상담 접수 완료', '{{parentName}}님의 상담 신청이 접수되었습니다.\n유형: {{consultationType}}\n담당자가 곧 연락드리겠습니다.', '["parentName","consultationType"]');
