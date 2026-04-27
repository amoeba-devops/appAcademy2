-- ============================================================
-- 100-migration-posts-category.sql
-- ------------------------------------------------------------
-- Adds pst_category column to tac_posts.
--
-- Context:
--   - Backend PostEntity already declares `pstCategory` (post.entity.ts)
--   - Frontend types/news.ts ships RESULT/EVENT/NOTICE enum
--   - Schema (010-academy-management-schema.sql) was missing the column
--   - Resolves ADR-001 follow-up #2
--
-- Idempotent: checks information_schema before ALTER + CREATE INDEX.
-- ============================================================

SET @col_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'tac_posts'
      AND column_name  = 'pst_category'
);

SET @sql := IF(@col_exists = 0,
    'ALTER TABLE tac_posts
        ADD COLUMN pst_category VARCHAR(30) NOT NULL DEFAULT ''NOTICE''
        COMMENT ''RESULT/EVENT/NOTICE''
        AFTER pst_status',
    'SELECT ''pst_category column already present — skipping ALTER'' AS note'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name   = 'tac_posts'
      AND index_name   = 'idx_tac_posts_acd_cat_pub'
);

SET @sql := IF(@idx_exists = 0,
    'CREATE INDEX idx_tac_posts_acd_cat_pub
        ON tac_posts (acd_id, pst_category, pst_status, pst_published_at)',
    'SELECT ''idx_tac_posts_acd_cat_pub already present — skipping CREATE INDEX'' AS note'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
