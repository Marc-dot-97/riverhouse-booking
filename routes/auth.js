import express from "express";
import bcrypt from "bcryptjs";
import * as repo from "../lib/repo.js";
import { loginLocked, recordLoginFail, clearLoginFails } from "../lib/auth.js";

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
      req.session.user = {
        id: user.UserId,
        name: user.DisplayName,
        initials: user.Initials,
        isAdmin: !!user.IsAdmin,
        mustChange: !!user.MustChangePassword,
      };
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

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

export default router;
