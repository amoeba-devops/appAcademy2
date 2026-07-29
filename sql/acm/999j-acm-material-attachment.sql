-- REQ-260728B FR-2 — 문서(DOC) 게시글 첨부파일 (portal 문서/자료실).
--
-- DOC 게시글에 파일을 첨부한다. 파일은 S3/MinIO 에 저장하고 이 행이 메타 +
-- object key 를 보관한다. FILE 게시글은 자체가 파일이므로 첨부를 갖지 않는다.
-- 열람 = 게시글 canView 상속, 추가/삭제 = canEdit(작성자·EDITOR) 상속.
--
-- Caps enforced in the service: ≤50MB × ≤5 rows / doc.
--
-- @see docs/plan/PLN-260728B-portal-materials-share-attach-paging.md §3

CREATE TABLE IF NOT EXISTS amb_acm_material_attachment (
  mta_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id          UUID         NOT NULL,
  mat_id          UUID         NOT NULL,
  mta_s3_key      VARCHAR(500) NOT NULL,
  mta_filename    VARCHAR(255) NOT NULL,
  mta_mime        VARCHAR(100),
  mta_size_bytes  BIGINT       CHECK (mta_size_bytes IS NULL OR (mta_size_bytes > 0 AND mta_size_bytes <= 52428800)),
  mta_uploaded_by UUID,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acm_mat_attach_mat
  ON amb_acm_material_attachment (ent_id, mat_id)
  WHERE deleted_at IS NULL;
