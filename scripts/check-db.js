// Quick connection test:  npm run check-db
import "dotenv/config";
import { getPool } from "../lib/db.js";

const pool = getPool();
try {
  const [rows] = await pool.query(`
    SELECT @@hostname AS ServerName, VERSION() AS MySqlVersion, DATABASE() AS DatabaseName,
      (SELECT COUNT(*) FROM users) AS Users,
      (SELECT COUNT(*) FROM bookings WHERE Status = 'Confirmed') AS ConfirmedBookings,
      (SELECT COUNT(*) FROM booking_lock) AS LockRows,
      (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('email_log', 'app_settings', 'readonly_emails', 'sessions')) AS NewerTables`);
  const row = rows[0];
  console.log("✔ Connected:", row);
  if (Number(row.LockRows) !== 1) console.log("⚠ booking_lock row is missing - run db/002_tables.sql again.");
  if (Number(row.NewerTables) < 4) console.log("⚠ Some tables are missing - run db/003, 004 and 005 in order (all are safe to re-run).");
} catch (err) {
  console.error("✖ Could not connect:", err.code || "", err.message);
  if (err.code === "ER_NO_SUCH_TABLE") console.error("  The tables aren't there yet - run db/002_tables.sql.");
  else if (err.code === "ER_BAD_DB_ERROR") console.error("  The database doesn't exist yet - run db/001_create_database_and_user.sql.");
  else console.error("  Check DB_HOST / DB_USER / DB_PASSWORD in .env, and that MySQL accepts connections on port", process.env.DB_PORT || 3306);
  process.exitCode = 1;
} finally {
  await pool.end();
}
