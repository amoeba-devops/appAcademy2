-- REQ-261112 — 학부모 정보에 국가번호·메신저(종류+아이디)·메모 추가 (멱등).
ALTER TABLE amb_acm_std_parent
  ADD COLUMN IF NOT EXISTS par_country_code   VARCHAR(8),
  ADD COLUMN IF NOT EXISTS par_messenger_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS par_messenger_id   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS par_memo           TEXT;

ALTER TABLE amb_acm_std_parent DROP CONSTRAINT IF EXISTS chk_acm_std_par_messenger_type;
ALTER TABLE amb_acm_std_parent
  ADD CONSTRAINT chk_acm_std_par_messenger_type
  CHECK (par_messenger_type IS NULL
         OR par_messenger_type IN ('KAKAOTALK','LINE','WECHAT','WHATSAPP','TELEGRAM','ZALO'));

COMMENT ON COLUMN amb_acm_std_parent.par_country_code   IS '전화 국가번호 (예: +82)';
COMMENT ON COLUMN amb_acm_std_parent.par_messenger_type IS 'KAKAOTALK|LINE|WECHAT|WHATSAPP|TELEGRAM|ZALO';
COMMENT ON COLUMN amb_acm_std_parent.par_messenger_id   IS '메신저 아이디';
COMMENT ON COLUMN amb_acm_std_parent.par_memo           IS '학부모 메모 (내부용)';
