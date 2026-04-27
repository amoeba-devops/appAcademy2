-- app-academy — MySQL container first-boot initialization.
-- Runs once when the mysql-data volume is empty (docker-entrypoint-initdb.d).
-- Schema + seed files are applied separately by scripts/deploy-staging.sh
-- via the `sql/_applied/` tracking ledger.

CREATE DATABASE IF NOT EXISTS db_tac
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- The `tac` user is auto-created by MYSQL_USER/MYSQL_PASSWORD env vars.
-- Ensure it has full access to db_tac (it already owns it by default, but
-- this is explicit for clarity and survives edge cases).
GRANT ALL PRIVILEGES ON db_tac.* TO 'tac'@'%';
FLUSH PRIVILEGES;
