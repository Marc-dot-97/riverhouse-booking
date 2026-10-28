import crypto from "node:crypto";

import * as repo from "./repo.js";

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
    req.session.user = {
      id: fresh.UserId,
      name: fresh.DisplayName,
      initials: fresh.Initials,
      isAdmin: !!fresh.IsAdmin,
      mustChange: !!fresh.MustChangePassword,
    };
    res.locals.user = req.session.user;

    // Temporary password? Send them to My account until they've picked their own.
    const allowed = req.baseUrl === "/account";
    if (req.session.user.mustChange && !allowed) return res.redirect("/account");
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Admin pages only. */
export function requireAdmin(req, res, next) {
  if (req.session.user?.isAdmin) return next();
  return res.status(403).render("error", { title: "Admins only", message: "Only an administrator can open that page." });
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
