-- =====================================================================
-- 004 - Sign-up page + read-only accounts
-- WHERE:  MySQL Workbench, connected to 10.10.1.4 as root/admin.
-- RUN:    Once, after 003. Safe to re-run.
-- =====================================================================

USE riverhouse_booking;

-- users.IsReadOnly: 1 = can see the calendar and who's going, but can't book, change or cancel.
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'IsReadOnly') = 0,
  'ALTER TABLE users ADD COLUMN IsReadOnly TINYINT NOT NULL DEFAULT 0 AFTER IsAdmin',
  'SELECT ''IsReadOnly already exists'' AS Info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- users.ProfileComplete: 0 = signed up but hasn't added their family yet (name, initials, colour).
-- Existing accounts are complete (DEFAULT 1).
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ProfileComplete') = 0,
  'ALTER TABLE users ADD COLUMN ProfileComplete TINYINT NOT NULL DEFAULT 1 AFTER IsReadOnly',
  'SELECT ''ProfileComplete already exists'' AS Info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Email addresses that always get a READ-ONLY account when they sign up.
CREATE TABLE IF NOT EXISTS readonly_emails (
  Email    VARCHAR(256) NOT NULL,
  AddedAt  DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (Email)
) ENGINE = InnoDB;

INSERT IGNORE INTO readonly_emails (Email) VALUES
  ('andromeda@optimumgroup.co.za'),
  ('nasreen@optimumgroup.co.za');

-- If either of them already has an account, make it read-only now.
UPDATE users u
  JOIN readonly_emails r ON r.Email = u.Email
   SET u.IsReadOnly = 1, u.IsAdmin = 0, u.ProfileComplete = 1;
