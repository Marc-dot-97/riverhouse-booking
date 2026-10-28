import express from "express";
import * as repo from "../lib/repo.js";
import { todayISO, nightsBetween, formatRange, formatDay, addDays, toISO, parseISO } from "../lib/dates.js";
import { readStayForm, validateStay } from "../lib/validate.js";

const router = express.Router();

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function clashMessage(clash, userId) {
  const who = clash.UserId === userId ? "your own stay" : `the ${clash.DisplayName} stay`;
  return `Those dates overlap ${who} (${formatRange(clash.CheckIn, clash.CheckOut)}). Please choose other dates.`;
}

function canEdit(booking, user, today) {
  return booking
    && booking.Status === "Confirmed"
    && (booking.UserId === user.id || user.isAdmin)
    && toISO(booking.CheckOut) > today; // finished stays can't be changed
}

function renderForm(res, { values, error, status = 200, booking = null }) {
  const today = todayISO();
  const started = booking ? toISO(booking.CheckIn) < today : false;
  res.status(status).render("book", {
    title: booking ? "Change your stay" : "Book a stay",
    active: booking ? "" : "book",
    values,
    error,
    today,
    booking,
    started,
    originalRange: booking ? formatRange(booking.CheckIn, booking.CheckOut) : "",
  });
}

// ---------- New booking ----------

router.get("/new", (req, res) => {
  const today = todayISO();
  const checkIn = parseISO(req.query.checkIn) && req.query.checkIn >= today ? req.query.checkIn : "";
  const defaultOut = checkIn ? toISO(addDays(parseISO(checkIn), 1)) : "";
  const checkOut = parseISO(req.query.checkOut) && req.query.checkOut > checkIn ? req.query.checkOut : defaultOut;
  renderForm(res, { values: { checkIn, checkOut, guests: 2, note: "" } });
});

router.post("/", async (req, res, next) => {
  const values = readStayForm(req.body);
  try {
    const v = validateStay(values, todayISO());
    if (v.error) return renderForm(res, { values, error: v.error, status: 400 });

    const result = await repo.createBooking({
      userId: req.session.user.id, checkIn: v.checkIn, checkOut: v.checkOut,
      guests: values.guests, note: values.note,
    });
    if (result.clash) {
      return renderForm(res, { values, status: 409, error: clashMessage(result.clash, req.session.user.id) });
    }

    const nights = nightsBetween(v.checkIn, v.checkOut);
    req.flash("success", `Booked: ${formatDay(v.checkIn)} to ${formatDay(v.checkOut)} (${plural(nights, "night")}). Everyone can now see your stay.`);
    return res.redirect(`/?m=${values.checkIn.slice(0, 7)}`);
  } catch (err) {
    next(err);
  }
});

// ---------- Change an existing booking ----------

async function loadEditable(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  const booking = Number.isInteger(id) ? await repo.getBooking(id) : null;
  if (!canEdit(booking, req.session.user, todayISO())) {
    req.flash("error", "That stay can't be changed. It may have finished, been cancelled, or belong to another family.");
    res.redirect("/");
    return null;
  }
  return booking;
}

router.get("/:id/edit", async (req, res, next) => {
  try {
    const booking = await loadEditable(req, res);
    if (!booking) return;
    renderForm(res, {
      booking,
      values: {
        checkIn: toISO(booking.CheckIn),
        checkOut: toISO(booking.CheckOut),
        guests: booking.Guests,
        note: booking.Note || "",
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id", async (req, res, next) => {
  try {
    const booking = await loadEditable(req, res);
    if (!booking) return;

    const values = readStayForm(req.body);
    const today = todayISO();
    const started = toISO(booking.CheckIn) < today;
    const v = validateStay(values, today, { lockedCheckIn: started ? toISO(booking.CheckIn) : null });
    if (v.error) return renderForm(res, { booking, values, error: v.error, status: 400 });

    const result = await repo.updateBooking({
      bookingId: booking.BookingId,
      byUserId: req.session.user.id,
      isAdmin: req.session.user.isAdmin,
      checkIn: v.checkIn, checkOut: v.checkOut,
      guests: values.guests, note: values.note,
    });
    if (result.notFound) {
      req.flash("error", "That stay was cancelled or changed by someone else in the meantime.");
      return res.redirect("/");
    }
    if (result.clash) {
      return renderForm(res, { booking, values, status: 409, error: clashMessage(result.clash, req.session.user.id) });
    }

    const was = formatRange(booking.CheckIn, booking.CheckOut);
    const nights = nightsBetween(v.checkIn, v.checkOut);
    const whose = booking.UserId === req.session.user.id ? "Your stay" : `The ${booking.DisplayName} stay`;
    req.flash("success", `${whose} is now ${formatRange(v.checkIn, v.checkOut)} (${plural(nights, "night")}). It was ${was}.`);
    return res.redirect(`/?m=${values.checkIn.slice(0, 7)}`);
  } catch (err) {
    next(err);
  }
});

// ---------- Cancel ----------

router.post("/:id/cancel", async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const booking = Number.isInteger(id) ? await repo.getBooking(id) : null;
    const ok = booking && await repo.cancelBooking({
      bookingId: id,
      byUserId: req.session.user.id,
      isAdmin: req.session.user.isAdmin,
    });
    if (ok) req.flash("success", `Cancelled the ${booking.DisplayName} stay (${formatRange(booking.CheckIn, booking.CheckOut)}). Those dates are open again.`);
    else req.flash("error", "That booking couldn't be cancelled (it may already be cancelled, or isn't yours).");
    const month = booking ? toISO(booking.CheckIn).slice(0, 7) : "";
    res.redirect(month ? `/?m=${month}` : "/");
  } catch (err) {
    next(err);
  }
});

export default router;
