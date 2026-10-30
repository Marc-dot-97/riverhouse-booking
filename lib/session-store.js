// Stores sign-in sessions in MySQL (table "sessions", db/005_sessions.sql),
// so restarting the app or the server doesn't sign everyone out.
import session from "express-session";
import { getPool } from "./db.js";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export class MySqlSessionStore extends session.Store {
  constructor() {
    super();
    // Tidy up expired sessions every 15 minutes.
    this.sweeper = setInterval(() => {
      getPool().query("DELETE FROM sessions WHERE Expires < ?", [Date.now()]).catch(() => {});
    }, 15 * 60 * 1000);
    this.sweeper.unref();
  }

  static expiresOf(sess) {
    const exp = sess?.cookie?.expires;
    return exp ? new Date(exp).getTime() : Date.now() + THIRTY_DAYS;
  }

  get(sid, cb) {
    getPool().query("SELECT Data, Expires FROM sessions WHERE SessionId = ?", [sid])
      .then(([rows]) => {
        if (!rows.length || Number(rows[0].Expires) < Date.now()) return cb(null, null);
        return cb(null, JSON.parse(rows[0].Data));
      })
      .catch(cb);
  }

  set(sid, sess, cb = () => {}) {
    getPool().query(
      `INSERT INTO sessions (SessionId, Expires, Data) VALUES (?, ?, ?) AS new
       ON DUPLICATE KEY UPDATE Expires = new.Expires, Data = new.Data`,
      [sid, MySqlSessionStore.expiresOf(sess), JSON.stringify(sess)])
      .then(() => cb(null)).catch(cb);
  }

  touch(sid, sess, cb = () => {}) {
    getPool().query("UPDATE sessions SET Expires = ? WHERE SessionId = ?", [MySqlSessionStore.expiresOf(sess), sid])
      .then(() => cb(null)).catch(cb);
  }

  destroy(sid, cb = () => {}) {
    getPool().query("DELETE FROM sessions WHERE SessionId = ?", [sid])
      .then(() => cb(null)).catch(cb);
  }
}
