-- ============================================================================
-- 110-migration-menu-permissions.sql
-- ----------------------------------------------------------------------------
-- Purpose: Per-tenant, per-role admin sidebar menu visibility & access control.
-- Idempotent. Safe to run multiple times.
--
-- Canonical roles (normalized server-side):
--   OWNER, ADMIN, STAFF, READONLY
-- Legacy mapping:
--   MASTER → OWNER ;  TEACHER/ACCOUNTANT → STAFF
--
-- Menu keys mirror frontend/src/components/admin/admin-sidebar.tsx:
--   dashboard, consultations, students, teachers, programs, classes,
--   timetable, enrollments, map, payments, posts, notifications, settings
-- ============================================================================

-- 1) Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tac_menu_permissions (
    mnp_id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id              BIGINT UNSIGNED NOT NULL,
    mnp_menu_key        VARCHAR(40)     NOT NULL COMMENT 'sidebar nav key',
    mnp_role            VARCHAR(20)     NOT NULL COMMENT 'OWNER/ADMIN/STAFF/READONLY',
    mnp_visible         TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'show in sidebar',
    mnp_accessible      TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'allow URL access',
    mnp_created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mnp_updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (mnp_id),
    UNIQUE KEY uq_tac_menu_permissions_acd_menu_role (acd_id, mnp_menu_key, mnp_role),
    KEY idx_tac_menu_permissions_acd_role (acd_id, mnp_role),
    CONSTRAINT fk_tac_menu_permissions_academy
        FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Default seed for every existing academy --------------------------------
--   Defaults: OWNER/ADMIN see+access all; STAFF cannot access settings;
--             READONLY visible everywhere but no settings access.
INSERT IGNORE INTO tac_menu_permissions (acd_id, mnp_menu_key, mnp_role, mnp_visible, mnp_accessible)
SELECT a.acd_id, m.menu_key, r.role, 1,
       CASE
           WHEN m.menu_key = 'settings' AND r.role IN ('STAFF','READONLY') THEN 0
           ELSE 1
       END
FROM tac_academies a
CROSS JOIN (
    SELECT 'dashboard' AS menu_key UNION ALL
    SELECT 'consultations'         UNION ALL
    SELECT 'students'              UNION ALL
    SELECT 'teachers'              UNION ALL
    SELECT 'programs'              UNION ALL
    SELECT 'classes'               UNION ALL
    SELECT 'timetable'             UNION ALL
    SELECT 'enrollments'           UNION ALL
    SELECT 'map'                   UNION ALL
    SELECT 'payments'              UNION ALL
    SELECT 'posts'                 UNION ALL
    SELECT 'notifications'         UNION ALL
    SELECT 'settings'
) m
CROSS JOIN (
    SELECT 'OWNER' AS role UNION ALL
    SELECT 'ADMIN'         UNION ALL
    SELECT 'STAFF'         UNION ALL
    SELECT 'READONLY'
) r;

-- DOWN ----------------------------------------------------------------------
-- DROP TABLE IF EXISTS tac_menu_permissions;
