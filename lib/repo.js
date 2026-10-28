// All SQL lives here, always with ? placeholders (never string-built SQL).
import crypto from "node:crypto";
import { getPool } from "./db.js";
import { parseISO, toISO } from "./dates.js";

const BOOKING_COLUMNS = `
  b.BookingId, b.UserId, b.CheckIn, b.CheckOut, b.Guests, b.Note, b.Status,
  b.CreatedAt, b.UpdatedAt, u.DisplayName, u.Initials, u.Colour, u.TextColour`;

// MySQL returns DATE columns as "YYYY-MM-DD" text - turn them into UTC dates for lib/dates.js.
function toBooking(row) {
  return { ...row, CheckIn: parseISO(row.CheckIn), CheckOut: parseISO(row.CheckOut) };
}

const day = (value) => (value instanceof Date ? toISO(value) : value);

export async function findUserByEmail(email) {
  const [rows] = await getPool().query(
    "SELECT * FROM users WHERE Email = ? AND IsActive = 1", [email]);
  return rows[0] || null;
}

export async function findUserById(userId) {
  const [rows] = await getPool().query(
    "SELECT * FROM users WHERE UserId = ? AND IsActive = 1", [userId]);
  return rows[0] || null;
}

export async function findUserByIcsToken(token) {
  const [rows] = await getPool().query(
    "SELECT UserId FROM users WHERE IcsToken = ? AND IsActive = 1", [token.toLowerCase()]);
  return rows[0] || null;
}

export async function touchLastLogin(userId) {
  await getPool().query("UPDATE users SET LastLoginAt = UTC_TIMESTAMP() WHERE UserId = ?", [userId]);
}

export async function updatePasswordHash(userId, hash) {
  await getPool().query("UPDATE users SET PasswordHash = ? WHERE UserId = ?", [hash, userId]);
}

export async function createUser({ email, displayName, initials, colour, textColour, passwordHash, isAdmin }) {
  const [result] = await getPool().query(
    `INSERT INTO users (Email, DisplayName, Initials, Colour, TextColour, PasswordHash, IsAdmin, IcsToken)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    // Random (v4) token for the private Outlook link - MySQL's UUID() is time-based and guessable.
    [email, displayName, initials, colour, textColour, passwordHash, isAdmin ? 1 : 0, crypto.randomUUID()]);
  return result.insertId;
}

export async function countUsers() {
  const [rows] = await getPool().query("SELECT COUNT(*) AS n FROM users");
  return { n: Number(rows[0].n) };
}

/** Confirmed stays that have at least one night inside [start, end). */
export async function bookingsBetween(start, end) {
  const [rows] = await getPool().query(
    `SELECT ${BOOKING_COLUMNS}
     FROM bookings b JOIN users u ON u.UserId = b.UserId
     WHERE b.Status = 'Confirmed' AND b.CheckIn < ? AND b.CheckOut > ?
     ORDER BY b.CheckIn`,
    [day(end), day(start)]);
  return rows.map(toBooking);
}

export async function getBooking(bookingId) {
  const [rows] = await getPool().query(
    `SELECT ${BOOKING_COLUMNS}
     FROM bookings b JOIN users u ON u.UserId = b.UserId
     WHERE b.BookingId = ?`, [bookingId]);
  return rows[0] ? toBooking(rows[0]) : null;
}

/**
 * Creates a booking ONLY if no confirmed booking overlaps.
 * Two stays overlap when:  new.CheckIn < existing.CheckOut  AND  new.CheckOut > existing.CheckIn
 * (so leaving on the 6th and someone else arriving on the 6th is fine).
 *
 * The SELECT ... FOR UPDATE on the single booking_lock row makes bookings take turns:
 * if two people click "Book" at the same moment, the second one waits for the first to
 * finish, then sees the first booking and gets a clash instead of a double booking.
 *
 * Returns { bookingId } on success or { clash: <booking row> } when the dates are taken.
 */
export async function createBooking({ userId, checkIn, checkOut, guests, note }) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [lock] = await conn.query("SELECT LockId FROM booking_lock WHERE LockId = 1 FOR UPDATE");
    if (!lock.length) throw new Error("booking_lock row is missing - run db/002_tables.sql again.");

    const [clash] = await conn.query(
      `SELECT BookingId FROM bookings
       WHERE Status = 'Confirmed' AND CheckIn < ? AND CheckOut > ?
       ORDER BY CheckIn LIMIT 1`,
      [day(checkOut), day(checkIn)]);
    if (clash.length) {
      await conn.rollback();
      return { clash: await getBooking(clash[0].BookingId) };
    }

    const [result] = await conn.query(
      "INSERT INTO bookings (UserId, CheckIn, CheckOut, Guests, Note) VALUES (?, ?, ?, ?, ?)",
      [userId, day(checkIn), day(checkOut), guests, note ? note : null]);
    await conn.commit();
    return { bookingId: result.insertId };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Changes the dates / guests / note of a confirmed booking.
 * Same take-turns lock as createBooking; the overlap check ignores the booking itself,
 * so you can shorten, extend or move your stay into nights it already covers.
 * Only the owner (or an admin) can change it.
 * Returns { ok: true } | { clash: <booking row> } | { notFound: true }.
 */
export async function updateBooking({ bookingId, byUserId, isAdmin, checkIn, checkOut, guests, note }) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [lock] = await conn.query("SELECT LockId FROM booking_lock WHERE LockId = 1 FOR UPDATE");
    if (!lock.length) throw new Error("booking_lock row is missing - run db/002_tables.sql again.");

    const [mine] = await conn.query(
      `SELECT BookingId FROM bookings
       WHERE BookingId = ? AND Status = 'Confirmed' AND (UserId = ? OR ? = 1)
       FOR UPDATE`,
      [bookingId, byUserId, isAdmin ? 1 : 0]);
    if (!mine.length) {
      await conn.rollback();
      return { notFound: true };
    }

    const [clash] = await conn.query(
      `SELECT BookingId FROM bookings
       WHERE Status = 'Confirmed' AND BookingId <> ? AND CheckIn < ? AND CheckOut > ?
       ORDER BY CheckIn LIMIT 1`,
      [bookingId, day(checkOut), day(checkIn)]);
    if (clash.length) {
      await conn.rollback();
      return { clash: await getBooking(clash[0].BookingId) };
    }

    await conn.query(
      `UPDATE bookings
          SET CheckIn = ?, CheckOut = ?, Guests = ?, Note = ?, UpdatedAt = UTC_TIMESTAMP()
        WHERE BookingId = ?`,
      [day(checkIn), day(checkOut), guests, note ? note : null, bookingId]);
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/** Owners can cancel their own stays; admins can cancel any. Returns true if it was cancelled. */
export async function cancelBooking({ bookingId, byUserId, isAdmin }) {
  const [result] = await getPool().query(
    `UPDATE bookings
        SET Status = 'Cancelled', CancelledAt = UTC_TIMESTAMP(), CancelledBy = ?, UpdatedAt = UTC_TIMESTAMP()
      WHERE BookingId = ? AND Status = 'Confirmed' AND (UserId = ? OR ? = 1)`,
    [byUserId, bookingId, byUserId, isAdmin ? 1 : 0]);
  return result.affectedRows > 0;
}

export async function upcomingForUser(userId, fromDate) {
  const [rows] = await getPool().query(
    `SELECT ${BOOKING_COLUMNS}
     FROM bookings b JOIN users u ON u.UserId = b.UserId
     WHERE b.UserId = ? AND b.Status = 'Confirmed' AND b.CheckOut > ?
     ORDER BY b.CheckIn`,
    [userId, day(fromDate)]);
  return rows.map(toBooking);
}
