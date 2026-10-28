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
    if (!(await bcrypt.compare(current, user.PasswordHash))) pwError = "Your current password isn't right.";
    else if (next1.length < 10) pwError = "The new password must be at least 10 characters.";
    else if (next1 !== next2) pwError = "The two new passwords don't match.";
    if (pwError) return render(req, res.status(400), { pwError });

    await repo.updatePasswordHash(user.UserId, await bcrypt.hash(next1, 12));
    req.flash("success", "Your password has been changed.");
    res.redirect("/account");
  } catch (err) {
    next(err);
  }
});

export default router;
