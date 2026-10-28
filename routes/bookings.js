import express from "express";
import * as repo from "../lib/repo.js";
import { todayISO, nightsBetween, formatRange, formatDay, addDays, toISO, parseISO } from "../lib/dates.js";
import { readStayForm, validateStay } from "../lib/validate.js";
import { notifyStay } from "../lib/notify.js";

const router = express.Router();

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Emails everyone in the background - the page doesn't wait, and a mail problem never blocks a booking. */
function emailEveryone(type, bookingId, req, before = null) {
  const actor = { id: req.session.user.id, name: req.session.user.name };
  repo.getBooking(bookingId)
    .then((booking) => booking && notifyStay({ type, booking, before, actor }))
    .catch((err) => console.error(`✖ Could not send "${type}" emails for booking ${bookingId}:`, err.message));
}

function clashMessage(clash, userId) {
  const range = formatRange(clash.CheckIn, clash.CheckOut);
  return clash.UserId === userId
    ? `You're already at the house then (${range}). Choose dates around your existing stay.`
    : `${clash.DisplayName} is at the house during those dates (${range}). Please choose other dates.`;
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

    emailEveryone("booked", result.bookingId, req);
    const nights = nightsBetween(v.checkIn, v.checkOut);
    req.flash("success", `Your stay is booked: ${formatRange(v.checkIn, v.checkOut)}, ${plural(nights, "night")}. Everyone can see it on the calendar now.`);
    return res.redirect(`/?m=${values.checkIn.slice(0, 7)}&hl=${result.bookingId}`);
  } catch (err) {
    next(err);
  }
});

// ---------- Change an existing booking ----------

async function loadEditable(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  const booking = Number.isInteger(id) ? await repo.getBooking(id) : null;
  if (!canEdit(booking, req.session.user, todayISO())) {
    req.flash("error", "You can't change that stay – it has finished, was cancelled, or belongs to another family.");
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
      req.flash("error", "Someone cancelled or changed that stay a moment ago. Please check the calendar and try again.");
      return res.redirect("/");
    }
    if (result.clash) {
      return renderForm(res, { booking, values, status: 409, error: clashMessage(result.clash, req.session.user.id) });
    }

    emailEveryone("changed", booking.BookingId, req, { CheckIn: booking.CheckIn, CheckOut: booking.CheckOut });
    const was = formatRange(booking.CheckIn, booking.CheckOut);
    const nights = nightsBetween(v.checkIn, v.checkOut);
    const whose = booking.UserId === req.session.user.id ? "Your stay" : `The ${booking.DisplayName} stay`;
    req.flash("success", `${whose} now runs ${formatRange(v.checkIn, v.checkOut)}, ${plural(nights, "night")} – previously ${was}.`);
    return res.redirect(`/?m=${values.checkIn.slice(0, 7)}&hl=${booking.BookingId}`);
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
    if (ok) emailEveryone("cancelled", id, req);
    if (ok) req.flash("success", `You cancelled the ${booking.DisplayName} stay (${formatRange(booking.CheckIn, booking.CheckOut)}). Those nights are open for everyone again.`);
    else req.flash("error", "You can't cancel that stay – it's already cancelled or belongs to another family.");
    const month = booking ? toISO(booking.CheckIn).slice(0, 7) : "";
    res.redirect(month ? `/?m=${month}` : "/");
  } catch (err) {
    next(err);
  }
});

export default router;
