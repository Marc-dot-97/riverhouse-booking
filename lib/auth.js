import crypto from "node:crypto";

/** Only let signed-in owners through. */
export function requireLogin(req, res, next) {
  if (req.session.user) return next();
  req.session.returnTo = req.originalUrl;
  return res.redirect("/login");
}

/** Simple CSRF protection: every form posts back a per-session token. */
export function csrf(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (req.method === "POST") {
    const sent = String(req.body?._csrf || "");
    const expected = req.session.csrfToken;
    const ok = sent.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
    if (!ok) {
      return res.status(403).render("error", {
        title: "Form expired",
        message: "That form has expired. Please go back, refresh the page and try again.",
      });
    }
  }
  return next();
}

/** One-time messages shown on the next page ("Your stay is booked"). */
export function flash(req, res, next) {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  req.flash = (type, text) => { req.session.flash = { type, text }; };
  next();
}

/** Very small in-memory brute-force guard for the login form. */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

export function loginLocked(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) { attempts.delete(key); return false; }
  return entry.count >= MAX_FAILS;
}

export function recordLoginFail(key) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
}

export function clearLoginFails(key) {
  attempts.delete(key);
}
