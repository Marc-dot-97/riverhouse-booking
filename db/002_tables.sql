-- =====================================================================
-- 002 - Tables
-- WHERE:  Same MySQL connection as 001 (root/admin account).
-- RUN:    After 001. Safe to re-run (only creates what is missing).
-- =====================================================================

USE riverhouse_booking;

-- People who can sign in and book (one row per family/owner).
CREATE TABLE IF NOT EXISTS users (
  UserId        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  Email         VARCHAR(256)  NOT NULL,
  DisplayName   VARCHAR(100)  NOT NULL,                  -- e.g. "Botha family"
  Initials      VARCHAR(3)    NOT NULL,                  -- e.g. "BO" (shown on the calendar bars)
  Colour        CHAR(7)       NOT NULL,                  -- bar colour, e.g. #212934
  TextColour    CHAR(7)       NOT NULL DEFAULT '#FFFFFF',
  PasswordHash  VARCHAR(100)  NOT NULL,                  -- bcrypt hash, never the password itself
  IsAdmin       TINYINT       NOT NULL DEFAULT 0,
  IsActive      TINYINT       NOT NULL DEFAULT 1,
  IcsToken      CHAR(36)      NOT NULL DEFAULT (UUID()), -- private Outlook link key (the app fills in a random one)
  CreatedAt     DATETIME      NOT NULL DEFAULT (UTC_TIMESTAMP()),
  LastLoginAt   DATETIME      NULL,
  PRIMARY KEY (UserId),
  UNIQUE KEY UX_users_Email (Email),
  UNIQUE KEY UX_users_IcsToken (IcsToken)
) ENGINE = InnoDB;

-- Stays. CheckIn = arrival day (first night). CheckOut = departure day
-- (NOT a night - the next family may arrive on that day).
CREATE TABLE IF NOT EXISTS bookings (
  BookingId    INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  UserId       INT UNSIGNED     NOT NULL,
  CheckIn      DATE             NOT NULL,
  CheckOut     DATE             NOT NULL,
  Guests       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  Note         VARCHAR(500)     NULL,
  Status       VARCHAR(10)      NOT NULL DEFAULT 'Confirmed',
  CreatedAt    DATETIME         NOT NULL DEFAULT (UTC_TIMESTAMP()),
  UpdatedAt    DATETIME         NULL,
  CancelledAt  DATETIME         NULL,
  CancelledBy  INT UNSIGNED     NULL,
  PRIMARY KEY (BookingId),
  KEY IX_bookings_Dates (Status, CheckIn, CheckOut),
  KEY IX_bookings_User (UserId, CheckIn),
  CONSTRAINT FK_bookings_users       FOREIGN KEY (UserId)      REFERENCES users (UserId),
  CONSTRAINT FK_bookings_cancelledby FOREIGN KEY (CancelledBy) REFERENCES users (UserId),
  CONSTRAINT CK_bookings_Dates  CHECK (CheckOut > CheckIn),
  CONSTRAINT CK_bookings_Status CHECK (Status IN ('Confirmed', 'Cancelled')),
  CONSTRAINT CK_bookings_Guests CHECK (Guests BETWEEN 1 AND 30)
) ENGINE = InnoDB;

-- One-row "turnstile" table. The app locks this row while it checks for
-- overlaps and saves a booking, so two people booking at the same moment
-- take turns and can never double-book the house.
CREATE TABLE IF NOT EXISTS booking_lock (
  LockId TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (LockId)
) ENGINE = InnoDB;

INSERT IGNORE INTO booking_lock (LockId) VALUES (1);

-- Phase 2 (Outlook two-way sync) will add a table like:
--   outlook_event_links (BookingId, UserId, GraphEventId, LastSyncedAt)
-- Not needed yet.
