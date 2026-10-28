// MySQL connection pool (one shared pool for the whole app).
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "riverhouse_booking",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  // DATE columns come back as "YYYY-MM-DD" text (no time-zone shifting); lib/repo.js turns them into dates.
  dateStrings: ["DATE"],
  // DATETIME columns are stored in UTC (UTC_TIMESTAMP() in the tables).
  timezone: "Z",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

export function getPool() {
  return pool;
}
