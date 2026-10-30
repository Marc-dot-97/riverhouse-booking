// Admin page: add families, change their details, reset passwords, see sent emails.
import express from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import * as repo from "../lib/repo.js";
import { PALETTE, isHex, textColourFor, nextFreeColour } from "../lib/palette.js";
import { sendLoginDetails, sendTestEmail } from "../lib/notify.js";
import { mailMode } from "../lib/mailer.js";
import { todayISO } from "../lib/dates.js";

const router = express.Router();

/** Easy-to-read temporary password, e.g. "kpwt-7hcz-m3qa" (no 0/O/1/l look-alikes). */
function tempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(12);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/** Reads + checks the family form. Returns { values, error }. */
function readFamilyForm(body) {
  const colour = isHex(body.colour) ? body.colour.toUpperCase() : "";
  const values = {
    email: String(body.email || "").trim().toLowerCase(),
    displayName: String(body.displayName || "").trim().slice(0, 100),
    initials: String(body.initials || "").trim().toUpperCase().slice(0, 3),
    colour,
    isAdmin: body.isAdmin === "on" && body.isReadOnly !== "on",
    isReadOnly: body.isReadOnly === "on",
    isActive: body.isActive === undefined ? true : body.isActive === "on",
    emailNotifications: body.emailNotifications === undefined ? true : body.emailNotifications === "on",
    sendEmail: body.sendEmail === "on",
  };
  let error = null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) error = "Enter a valid email address.";
  else if (!values.displayName) error = "Enter the name to show on the calendar, for example \"Botha family\".";
  else if (!/^[A-Z0-9]{1,3}$/.test(values.initials)) error = "Use 1 to 3 letters or numbers for the initials.";
  else if (!values.colour) error = "Choose a calendar colour.";
  return { values, error };
}

function renderFamily(res, { family = null, values, error = null, status = 200 }) {
  res.status(status).render("admin-family", {
    title: family ? `Edit ${family.DisplayName}` : "Add a family",
    active: "admin",
    family,
    values,
    error,
    palette: PALETTE,
    mailMode: mailMode(),
  });
}

/** Show a temporary password once, on the next page only. */
function rememberOnce(req, data) {
  req.session.oneTime = data;
}

// ---------- Overview ----------

router.get("/", async (req, res, next) => {
  try {
    const [families, emails] = await Promise.all([repo.listUsers(todayISO()), repo.recentEmails(30)]);
    res.render("admin", {
      title: "Admin",
      active: "admin",
      families,
      emails,
      mailMode: mailMode(),
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Add a family ----------

router.get("/families/new", async (req, res, next) => {
  try {
    const used = await repo.usedColours();
    const colour = nextFreeColour(used, used.length).bg;
    renderFamily(res, {
      values: { email: "", displayName: "", initials: "", colour, isAdmin: false, isActive: true, emailNotifications: true, sendEmail: mailMode() !== "log" },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/families", async (req, res, next) => {
  try {
    const { values, error } = readFamilyForm(req.body);
    if (error) return renderFamily(res, { values, error, status: 400 });
    if (await repo.findAnyUserByEmail(values.email)) {
      return renderFamily(res, { values, status: 409, error: "A family with that email address is already on the calendar." });
    }

    const password = tempPassword();
    const userId = await repo.createUser({
      email: values.email,
      displayName: values.displayName,
      initials: values.initials,
      colour: values.colour,
      textColour: textColourFor(values.colour),
      passwordHash: await bcrypt.hash(password, 12),
      isAdmin: values.isAdmin,
      isReadOnly: values.isReadOnly,
      mustChange: true,
    });
    if (!values.emailNotifications) await repo.setEmailNotifications(userId, false);

    let emailed = false;
    if (values.sendEmail) {
      const user = await repo.getUserForAdmin(userId);
      const r = await sendLoginDetails({ user, tempPassword: password, kind: "welcome" });
      emailed = r.sent > 0 && mailMode() !== "log";
    }
    rememberOnce(req, { userId, name: values.displayName, email: values.email, password, emailed, isNew: true });
    req.flash("success", `${values.displayName} is on the calendar.`);
    res.redirect(`/admin/families/${userId}`);
  } catch (err) {
    next(err);
  }
});

// ---------- Edit a family ----------

async function loadFamily(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  const family = Number.isInteger(id) ? await repo.getUserForAdmin(id) : null;
  if (!family) {
    req.flash("error", "We couldn't find that family.");
    res.redirect("/admin");
    return null;
  }
  return family;
}

router.get("/families/:id", async (req, res, next) => {
  try {
    const family = await loadFamily(req, res);
    if (!family) return;
    const oneTime = req.session.oneTime && req.session.oneTime.userId === family.UserId ? req.session.oneTime : null;
    delete req.session.oneTime;
    res.locals.oneTime = oneTime;
    renderFamily(res, {
      family,
      values: {
        email: family.Email,
        displayName: family.DisplayName,
        initials: family.Initials,
        colour: family.Colour,
        isAdmin: !!family.IsAdmin,
        isReadOnly: !!family.IsReadOnly,
        isActive: !!family.IsActive,
        emailNotifications: !!family.EmailNotifications,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/families/:id", async (req, res, next) => {
  try {
    const family = await loadFamily(req, res);
    if (!family) return;
    // Unticked checkboxes aren't sent by the browser - treat them as "off" here.
    const body = { ...req.body, isActive: req.body.isActive || "off", emailNotifications: req.body.emailNotifications || "off" };
    const { values, error } = readFamilyForm(body);
    if (error) return renderFamily(res, { family, values, error, status: 400 });

    const isMe = family.UserId === req.session.user.id;
    if (isMe && !values.isAdmin) return renderFamily(res, { family, values, status: 400, error: "You can't remove your own admin rights – another admin can do this for you." });
    if (isMe && !values.isActive) return renderFamily(res, { family, values, status: 400, error: "You can't deactivate your own account – another admin can do this for you." });
    if (isMe && values.isReadOnly) return renderFamily(res, { family, values, status: 400, error: "You can't make your own account read-only – another admin can do this for you." });
    const losingAdmin = family.IsAdmin && family.IsActive && (!values.isAdmin || !values.isActive);
    if (losingAdmin && (await repo.countActiveAdmins(family.UserId)) === 0) {
      return renderFamily(res, { family, values, status: 400, error: "The calendar needs at least one active admin. Make someone else an admin first." });
    }
    if (await repo.findAnyUserByEmail(values.email, family.UserId)) {
      return renderFamily(res, { family, values, status: 409, error: "Another family already uses that email address." });
    }

    await repo.updateUser(family.UserId, { ...values, textColour: textColourFor(values.colour) });
    req.flash("success", `${values.displayName} is saved.${!values.isActive ? " They can no longer sign in; their stays remain on the calendar." : ""}`);
    res.redirect("/admin");
  } catch (err) {
    next(err);
  }
});

router.post("/families/:id/reset-password", async (req, res, next) => {
  try {
    const family = await loadFamily(req, res);
    if (!family) return;
    const password = tempPassword();
    await repo.updatePasswordHash(family.UserId, await bcrypt.hash(password, 12), { mustChange: true });
    let emailed = false;
    if (req.body.sendEmail === "on") {
      const r = await sendLoginDetails({ user: family, tempPassword: password, kind: "reset" });
      emailed = r.sent > 0 && mailMode() !== "log";
    }
    rememberOnce(req, { userId: family.UserId, name: family.DisplayName, email: family.Email, password, emailed, isNew: false });
    res.redirect(`/admin/families/${family.UserId}`);
  } catch (err) {
    next(err);
  }
});

router.post("/families/:id/new-outlook-link", async (req, res, next) => {
  try {
    const family = await loadFamily(req, res);
    if (!family) return;
    await repo.regenerateIcsToken(family.UserId);
    req.flash("success", `${family.DisplayName} has a new Outlook link. The old one no longer works – they'll find the new link under My account.`);
    res.redirect(`/admin/families/${family.UserId}`);
  } catch (err) {
    next(err);
  }
});

// ---------- Email ----------

router.post("/test-email", async (req, res, next) => {
  try {
    const me = await repo.findUserById(req.session.user.id);
    const r = await sendTestEmail(me.Email);
    if (r.failed) req.flash("error", "The test email didn't go through. You'll find the reason in the email log.");
    else if (mailMode() === "log") req.flash("success", "Email is in log mode, so the test email appeared in the terminal instead of an inbox.");
    else req.flash("success", `Your test email is on its way to ${me.Email}. Check the junk folder if it doesn't arrive.`);
    res.redirect("/admin#email");
  } catch (err) {
    next(err);
  }
});

export default router;
