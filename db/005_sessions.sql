-- =====================================================================
-- 005 - Sign-in sessions stored in the database
-- Keeps everyone signed in when the app restarts (updates, server reboot).
-- WHERE:  MySQL Workbench as root - on PROD (10.10.1.2) and on Dev (10.10.1.4).
-- RUN:    Once, after 004. Safe to re-run.
-- =====================================================================

USE riverhouse_booking;

CREATE TABLE IF NOT EXISTS sessions (
  SessionId  VARCHAR(128)  NOT NULL,
  Expires    BIGINT        NOT NULL,          -- milliseconds since 1970 (UTC)
  Data       MEDIUMTEXT    NOT NULL,          -- the session as JSON (no passwords)
  PRIMARY KEY (SessionId),
  KEY IX_sessions_Expires (Expires)
) ENGINE = InnoDB;
