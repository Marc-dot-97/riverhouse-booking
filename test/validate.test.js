// Run with:  npm test
import test from "node:test";
import assert from "node:assert/strict";
import { validateStay, readStayForm } from "../lib/validate.js";

const today = "2026-10-28";
const form = (checkIn, checkOut, guests = 2) => readStayForm({ checkIn, checkOut, guests: String(guests) });

test("a normal future stay is valid", () => {
  const v = validateStay(form("2026-11-02", "2026-11-06"), today);
  assert.equal(v.error, undefined);
});

test("arrival in the past is refused for new bookings", () => {
  assert.match(validateStay(form("2026-10-27", "2026-10-30"), today).error, /past/);
});

test("departure must be after arrival", () => {
  assert.match(validateStay(form("2026-11-06", "2026-11-06"), today).error, /after the arrival/);
});

test("max 60 nights and guests 1-30", () => {
  assert.match(validateStay(form("2026-11-01", "2027-01-15"), today).error, /60 nights/);
  assert.match(validateStay(form("2026-11-01", "2026-11-03", 0), today).error, /Guests/);
});

test("a stay that already started: arrival locked, departure can move", () => {
  const locked = { lockedCheckIn: "2026-10-26" };
  assert.equal(validateStay(form("2026-10-26", "2026-11-02"), today, locked).error, undefined);
  assert.match(validateStay(form("2026-10-29", "2026-11-02"), today, locked).error, /already started/);
  assert.match(validateStay(form("2026-10-26", "2026-10-28"), today, locked).error, /after today/);
});
