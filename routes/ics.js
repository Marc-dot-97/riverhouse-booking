import express from "express";
import * as repo from "../lib/repo.js";
import { buildIcs } from "../lib/ics.js";
import { addDays, parseISO, todayISO } from "../lib/dates.js";

const router = express.Router();
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public on purpose (Outlook can't sign in) - protected by the long private token in the URL.
router.get("/:token.ics", async (req, res, next) => {
  try {
    if (!GUID.test(req.params.token)) return res.status(404).send("Not found");
    const owner = await repo.findUserByIcsToken(req.params.token);
    if (!owner) return res.status(404).send("Not found");

    const today = parseISO(todayISO());
    const bookings = await repo.bookingsBetween(addDays(today, -90), addDays(today, 730));
    const host = (process.env.BASE_URL ? new URL(process.env.BASE_URL).hostname : req.hostname) || "riverhouse";
    const body = buildIcs({ houseName: process.env.HOUSE_NAME || "Riverhouse", bookings, host });

    res.set({
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="riverhouse.ics"',
      "Cache-Control": "private, max-age=900",
    });
    res.send(body);
  } catch (err) {
    next(err);
  }
});

export default router;
