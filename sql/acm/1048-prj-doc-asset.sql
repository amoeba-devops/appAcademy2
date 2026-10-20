-- PLN-261020C — 문서 본문에 넣는 이미지·첨부 파일(ACM 저장소). 문서에는 고유 링크만 저장한다. 멱등.
CREATE TABLE IF NOT EXISTS amb_acm_prj_doc_asset (
  pda_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id      UUID NOT NULL,
  prj_id      UUID NOT NULL,
  object_key  VARCHAR(500) NOT NULL,
  file_name   VARCHAR(300) NOT NULL,
  mime_type   VARCHAR(150) NOT NULL,
  size_bytes  BIGINT NOT NULL,
  is_image    BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_acm_prj_doc_asset_prj ON amb_acm_prj_doc_asset (ent_id, prj_id);
