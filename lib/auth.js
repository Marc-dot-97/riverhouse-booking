import crypto from "node:crypto";

import * as repo from "./repo.js";

/** What we keep about the signed-in person in their session. */
export function sessionUserFrom(row) {
  return {
    id: row.UserId,
    name: row.DisplayName,
    initials: row.Initials,
    isAdmin: !!row.IsAdmin && !row.IsReadOnly,
    readOnly: !!row.IsReadOnly,
    profileComplete: row.ProfileComplete === undefined ? true : !!row.ProfileComplete,
    mustChange: !!row.MustChangePassword,
  };
}

/**
 * Only let signed-in owners through.
 * Re-reads the person from the database on every page, so an admin's changes
 * (deactivated, made admin, name/colour changed) take effect straight away.
 */
export async function requireLogin(req, res, next) {
  try {
    if (!req.session.user) {
      if (req.method === "GET") req.session.returnTo = req.originalUrl;
      return res.redirect("/login");
    }
    const fresh = await repo.findUserById(req.session.user.id);
    if (!fresh) {
      return req.session.destroy(() => res.redirect("/login"));
    }
    req.session.user = sessionUserFrom(fresh);
    res.locals.user = req.session.user;
    res.locals.newCount = 0;
    if (req.session.lastSeenAt && !req.session.user.mustChange) {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
      res.locals.newCount = await repo.countNewStays(new Date(req.session.lastSeenAt), fresh.UserId, today);
    }

    // Temporary password? Send them to My account until they've picked their own.
    if (req.session.user.mustChange && req.baseUrl !== "/account") return res.redirect("/account");
    // Just signed up? Send them to "Add your family" until it's done.
    if (!req.session.user.profileComplete && req.baseUrl !== "/welcome") return res.redirect("/welcome");
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Booking, changing and cancelling - not for read-only accounts. */
export function requireWriter(req, res, next) {
  if (!req.session.user?.readOnly) return next();
  if (req.method === "POST") req.flash("error", "Your account can view the calendar but not change it. An admin can upgrade it for you.");
  return res.redirect("/");
}

/** Admin pages only. */
export function requireAdmin(req, res, next) {
  if (req.session.user?.isAdmin) return next();
  return res.status(403).render("error", { title: "Admins only", message: "This page is for house administrators. Everything you need is on the calendar." });
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
        message: "For your security, this form expired. Go back, refresh the page and try once more.",
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
