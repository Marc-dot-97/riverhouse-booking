import express from "express";
import bcrypt from "bcryptjs";
import * as repo from "../lib/repo.js";
import { todayISO, parseISO, formatRange, nightsBetween } from "../lib/dates.js";

const router = express.Router();

async function render(req, res, extra = {}) {
  const user = await repo.findUserById(req.session.user.id);
  const base = (process.env.BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  const upcoming = (await repo.upcomingForUser(user.UserId, parseISO(todayISO()))).map((b) => ({
    ...b, range: formatRange(b.CheckIn, b.CheckOut), nights: nightsBetween(b.CheckIn, b.CheckOut),
  }));
  res.render("account", {
    title: "My account",
    active: "account",
    account: user, // (not "user" - that name is the signed-in person used by the sidebar)
    feedUrl: `${base}/ics/${String(user.IcsToken).toLowerCase()}.ics`,
    upcoming,
    pwError: null,
    ...extra,
  });
}

router.get("/", async (req, res, next) => {
  try { await render(req, res); } catch (err) { next(err); }
});

router.post("/password", async (req, res, next) => {
  try {
    const current = String(req.body.currentPassword || "");
    const next1 = String(req.body.newPassword || "");
    const next2 = String(req.body.confirmPassword || "");
    const user = await repo.findUserById(req.session.user.id);

    let pwError = null;
    if (!(await bcrypt.compare(current, user.PasswordHash))) pwError = "That isn't your current password. Please try again.";
    else if (next1.length < 10) pwError = "Choose a new password of at least 10 characters.";
    else if (next1 !== next2) pwError = "The two new passwords don't match yet.";
    else if (next1 === current) pwError = "Choose a password that's different from your current one.";
    if (pwError) return render(req, res.status(400), { pwError });

    const wasTemporary = !!user.MustChangePassword;
    await repo.updatePasswordHash(user.UserId, await bcrypt.hash(next1, 12)); // also clears MustChangePassword
    req.session.user.mustChange = false;
    req.flash("success", wasTemporary ? "Your new password is saved. Welcome to the house calendar." : "Your new password is saved.");
    res.redirect(wasTemporary ? "/" : "/account");
  } catch (err) {
    next(err);
  }
});

router.post("/notifications", async (req, res, next) => {
  try {
    const on = req.body.emailNotifications === "on";
    await repo.setEmailNotifications(req.session.user.id, on);
    req.flash("success", on ? "You'll receive an email whenever a stay is booked, changed or cancelled." : "You've switched booking emails off. You can turn them back on here at any time.");
    res.redirect("/account");
  } catch (err) {
    next(err);
  }
});

export default router;
