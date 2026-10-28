-- =====================================================================
-- 003 - Admin page + email notifications
-- WHERE:  MySQL Workbench, connected to 10.10.1.4 as root/admin
--         (same as scripts 001 and 002).
-- RUN:    Once, after 002. Safe to re-run (it checks before changing anything).
-- =====================================================================

USE riverhouse_booking;

-- MySQL has no "ADD COLUMN IF NOT EXISTS", so each column is added only
-- when information_schema says it isn't there yet.

-- users.MustChangePassword: 1 = must pick a new password at next sign-in
-- (set when an admin creates a family or resets their password).
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'MustChangePassword') = 0,
  'ALTER TABLE users ADD COLUMN MustChangePassword TINYINT NOT NULL DEFAULT 0 AFTER PasswordHash',
  'SELECT ''MustChangePassword already exists'' AS Info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- users.EmailNotifications: 1 = email me when stays are booked/changed/cancelled.
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'EmailNotifications') = 0,
  'ALTER TABLE users ADD COLUMN EmailNotifications TINYINT NOT NULL DEFAULT 1 AFTER IsActive',
  'SELECT ''EmailNotifications already exists'' AS Info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Every email the app sends (or tries to send) - shown on the admin page.
CREATE TABLE IF NOT EXISTS email_log (
  EmailLogId  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  CreatedAt   DATETIME      NOT NULL DEFAULT (UTC_TIMESTAMP()),
  ToEmail     VARCHAR(256)  NOT NULL,
  Subject     VARCHAR(255)  NOT NULL,
  Kind        VARCHAR(20)   NOT NULL,          -- booked / changed / cancelled / welcome / reset / test
  Status      VARCHAR(10)   NOT NULL,          -- Sent / Failed / Logged (dev mode, not really sent)
  Error       VARCHAR(500)  NULL,
  BookingId   INT UNSIGNED  NULL,
  PRIMARY KEY (EmailLogId),
  KEY IX_email_log_CreatedAt (CreatedAt)
) ENGINE = InnoDB;

-- Small key/value store. Used to keep the Outlook.com sign-in token
-- (MAIL_MODE=oauth2) so the app can keep sending email without a password.
CREATE TABLE IF NOT EXISTS app_settings (
  SettingKey    VARCHAR(64)  NOT NULL,
  SettingValue  TEXT         NULL,
  UpdatedAt     DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (SettingKey)
) ENGINE = InnoDB;
