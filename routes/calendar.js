import express from "express";
import * as repo from "../lib/repo.js";
import {
  parseMonthParam, monthKey, monthTitle, buildMonthGrid, freeRanges,
  formatRange, nightsBetween, todayISO, parseISO, addDays, toISO,
} from "../lib/dates.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const today = todayISO();
    const { year, month } = parseMonthParam(req.query.m, today);
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    const firstOfNext = new Date(Date.UTC(year, month + 1, 1));

    // The grid shows 6 weeks starting on the Monday on/before the 1st.
    const gridStart = addDays(firstOfMonth, -((firstOfMonth.getUTCDay() + 6) % 7));
    const me = req.session.user;
    const bookings = (await repo.bookingsBetween(gridStart, addDays(gridStart, 42))).map((b) => ({
      ...b,
      // Owners can change/cancel their own stays that haven't finished; admins can do any.
      canEdit: (b.UserId === me.id || me.isAdmin) && toISO(b.CheckOut) > today,
    }));
    const filled = buildMonthGrid(year, month, bookings, today);

    // Side panel: who's going this month
    const thisMonth = bookings
      .filter((b) => b.CheckIn < firstOfNext && b.CheckOut > firstOfMonth)
      .map((b) => ({
        ...b,
        range: formatRange(b.CheckIn, b.CheckOut),
        nights: nightsBetween(b.CheckIn, b.CheckOut),
        isMine: b.UserId === me.id,
      }));

    // Side panel: open dates (from today, inside this month)
    const todayDate = parseISO(today);
    const openFrom = todayDate > firstOfMonth ? todayDate : firstOfMonth;
    const open = openFrom < firstOfNext
      ? freeRanges(openFrom, firstOfNext, bookings).map((r) => ({
          ...r,
          startISO: toISO(r.start),
          endISO: toISO(r.end),
          range: formatRange(r.start, r.end),
        }))
      : [];

    res.render("calendar", {
      title: "Calendar",
      active: "calendar",
      month: monthTitle(year, month),
      prevMonth: monthKey(year, month - 1),
      nextMonth: monthKey(year, month + 1),
      todayMonth: today.slice(0, 7),
      weeks: filled.weeks,
      thisMonth,
      open,
      today,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
