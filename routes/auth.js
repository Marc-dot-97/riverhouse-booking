import express from "express";
import bcrypt from "bcryptjs";
import * as repo from "../lib/repo.js";
import { loginLocked, recordLoginFail, clearLoginFails, sessionUserFrom } from "../lib/auth.js";
import { nextFreeColour } from "../lib/palette.js";
import { notifyAdminsOfSignup } from "../lib/notify.js";

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("login", { title: "Sign in", error: null, email: "" });
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const key = `${email}|${req.ip}`;

    if (loginLocked(key)) {
      return res.status(429).render("login", {
        title: "Sign in", email,
        error: "For your security, sign-in is paused for 15 minutes. Please try again shortly.",
      });
    }

    const user = email ? await repo.findUserByEmail(email) : null;
    const ok = user ? await bcrypt.compare(password, user.PasswordHash) : false;

    if (!ok) {
      recordLoginFail(key);
      return res.status(401).render("login", {
        title: "Sign in", email, error: "That email and password don't match. Please try again.",
      });
    }

    clearLoginFails(key);
    const returnTo = req.session.returnTo || "/";
    // New session id on login (prevents session fixation).
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = sessionUserFrom(user);
      // "New since your last visit" badges compare against the previous sign-in.
      req.session.lastSeenAt = user.LastLoginAt ? new Date(user.LastLoginAt).toISOString() : null;
      repo.touchLastLogin(user.UserId).catch(() => {});
      const target = user.MustChangePassword ? "/account" : (returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/");
      req.session.save(() => res.redirect(target));
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Sign up ----------

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

router.get("/signup", (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("signup", { title: "Create your account", error: null, email: "" });
});

router.post("/signup", async (req, res, next) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const confirm = String(req.body.confirmPassword || "");
  const render = (status, error) => res.status(status).render("signup", { title: "Create your account", error, email });
  try {
    const key = `signup|${req.ip}`;
    if (loginLocked(key)) return render(429, "For your security, sign-up is paused for 15 minutes. Please try again shortly.");

    if (!EMAIL_RE.test(email) || email.length > 256) return render(400, "Enter a valid email address.");
    if (password.length < 10) return render(400, "Choose a password of at least 10 characters.");
    if (password !== confirm) return render(400, "The two passwords don't match yet.");
    if (await repo.findAnyUserByEmail(email)) {
      recordLoginFail(key);
      return render(409, "You already have an account with that email. Sign in instead – or ask your house administrator to reset your password.");
    }
    recordLoginFail(key); // counts sign-ups too: at most 5 new accounts per 15 minutes from one connection

    // Read-only people (db/004) need no family; everyone else adds theirs on the next page.
    const readOnly = await repo.isReadOnlyEmail(email);
    const local = email.split("@")[0].replace(/[^a-z]/gi, " ").trim();
    const name = local ? local.replace(/\b\w/g, (c) => c.toUpperCase()) : "New family";
    const { bg, fg } = nextFreeColour(await repo.usedColours(), 0);
    const userId = await repo.createUser({
      email,
      displayName: name.slice(0, 100),
      initials: (name.replace(/[^A-Za-z]/g, "").slice(0, 2) || "NF").toUpperCase(),
      colour: readOnly ? "#5F6A73" : bg,
      textColour: readOnly ? "#FFFFFF" : fg,
      passwordHash: await bcrypt.hash(password, 12),
      isAdmin: false,
      isReadOnly: readOnly,
      profileComplete: readOnly,
      emailNotifications: !readOnly,
    });
    const user = await repo.findUserById(userId);
    notifyAdminsOfSignup(user).catch((e) => console.error("Could not email admins about a sign-up:", e.message));

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = sessionUserFrom(user);
      req.session.lastSeenAt = null;
      repo.touchLastLogin(userId).catch(() => {});
      if (readOnly) req.flash("success", `Welcome, ${user.DisplayName}. You can follow every stay on the calendar.`);
      req.session.save(() => res.redirect(readOnly ? "/" : "/welcome"));
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

export default router;
