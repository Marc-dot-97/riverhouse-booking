// Run with:  npm test
import test from "node:test";
import assert from "node:assert/strict";
import { parseISO, overlaps, buildMonthGrid, freeRanges, formatRange, nightsBetween } from "../lib/dates.js";
import { buildIcs } from "../lib/ics.js";

const d = parseISO;

test("parseISO rejects bad dates", () => {
  assert.equal(parseISO("2026-02-30"), null);
  assert.equal(parseISO("nonsense"), null);
  assert.ok(parseISO("2026-11-02"));
});

test("checkout day is free for the next guest", () => {
  // Botha 2-6 Nov, Naidoo arrives 6 Nov -> no overlap
  assert.equal(overlaps(d("2026-11-02"), d("2026-11-06"), d("2026-11-06"), d("2026-11-13")), false);
  // Arriving 5 Nov would clash
  assert.equal(overlaps(d("2026-11-02"), d("2026-11-06"), d("2026-11-05"), d("2026-11-08")), true);
  // A stay fully inside another clashes
  assert.equal(overlaps(d("2026-11-01"), d("2026-11-30"), d("2026-11-10"), d("2026-11-12")), true);
});

test("November 2026 grid starts Monday 26 Oct and shows bars", () => {
  const bookings = [{ BookingId: 1, CheckIn: d("2026-11-02"), CheckOut: d("2026-11-06"), DisplayName: "Botha family", Initials: "BO" }];
  const grid = buildMonthGrid(2026, 10, bookings, "2026-10-27");
  assert.equal(grid.cells.length, 42);
  assert.equal(grid.cells[0].iso, "2026-10-26");
  const nov2 = grid.cells.find((c) => c.iso === "2026-11-02");
  const nov5 = grid.cells.find((c) => c.iso === "2026-11-05");
  const nov6 = grid.cells.find((c) => c.iso === "2026-11-06");
  assert.ok(nov2.bar.isStart && nov2.bar.showLabel);
  assert.ok(nov5.bar.isEnd);
  assert.equal(nov6.booking, null);
  assert.ok(grid.cells.find((c) => c.iso === "2026-10-27").isToday);
});

test("free ranges between bookings", () => {
  const bookings = [
    { CheckIn: d("2026-11-02"), CheckOut: d("2026-11-06") },
    { CheckIn: d("2026-11-06"), CheckOut: d("2026-11-13") },
    { CheckIn: d("2026-11-19"), CheckOut: d("2026-11-23") },
  ];
  const r = freeRanges(d("2026-11-01"), d("2026-12-01"), bookings);
  assert.deepEqual(r.map((x) => x.nights), [1, 6, 8]);
});

test("formatting", () => {
  assert.equal(formatRange(d("2026-11-02"), d("2026-11-06")), "Mon 2 – Fri 6 Nov");
  assert.equal(formatRange(d("2026-11-27"), d("2026-12-04")), "Fri 27 Nov – Fri 4 Dec");
  assert.equal(nightsBetween(d("2026-11-27"), d("2026-12-04")), 7);
});

test("ics feed has all-day events with exclusive end date", () => {
  const ics = buildIcs({
    houseName: "Riverhouse", host: "example.com",
    bookings: [{ BookingId: 7, CheckIn: d("2026-11-02"), CheckOut: d("2026-11-06"), DisplayName: "Botha family", Guests: 6, Note: "Boat, trailer" }],
  });
  assert.match(ics, /DTSTART;VALUE=DATE:20261102/);
  assert.match(ics, /DTEND;VALUE=DATE:20261106/);
  assert.match(ics, /Boat\\, trailer/);
  assert.ok(ics.includes("\r\n"));
});
