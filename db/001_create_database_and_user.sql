-- =====================================================================
-- 001 - Create the database + the app's own MySQL user
-- WHERE:  MySQL Workbench (or the mysql command line), connected to the
--         Dev/QA MySQL server 10.10.1.4 (port 3306) as root or another
--         admin account.
-- RUN:    Once per server. Safe to re-run (IF NOT EXISTS everywhere).
-- BEFORE: Replace  <<CHOOSE_A_STRONG_PASSWORD>>  below (keep the quotes).
--         Put the same password in your .env file as DB_PASSWORD.
-- NEEDS:  MySQL 8.0.16 or newer  ->  check with:  SELECT VERSION();
-- =====================================================================

CREATE DATABASE IF NOT EXISTS riverhouse_booking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- '%' = may connect from any machine. To lock it down to your office
-- network instead, use 'riverhouse_app'@'10.10.%' in all three lines below.
CREATE USER IF NOT EXISTS 'riverhouse_app'@'%'
  IDENTIFIED BY '<<CHOOSE_A_STRONG_PASSWORD>>';

-- The app only needs to read and write data - no right to drop or alter tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON riverhouse_booking.* TO 'riverhouse_app'@'%';

