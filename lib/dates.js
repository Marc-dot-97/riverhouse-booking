// Date helpers. All booking dates are plain calendar days ("YYYY-MM-DD"),
// handled in UTC so there are no time-zone surprises.
const DAY_MS = 86400000;
export const TIME_ZONE = "Africa/Johannesburg";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toISO(date) {
  return date.toISOString().slice(0, 10);
}

/** "2026-11-02" -> Date at UTC midnight, or null if not a real date. */
export function parseISO(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return toISO(date) === value ? date : null;
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function nightsBetween(checkIn, checkOut) {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS);
}

/** Today's date in South Africa as "YYYY-MM-DD". */
export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

/** "2026-11" -> { year: 2026, month: 10 } (month is 0-based); falls back to today. */
export function parseMonthParam(value, today = todayISO()) {
  const match = /^(\d{4})-(\d{2})$/.exec(value || "");
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    if (year >= 2000 && year <= 2100 && month >= 0 && month <= 11) return { year, month };
  }
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 };
}

export function monthKey(year, month) {
  const d = new Date(Date.UTC(year, month, 1));
  return toISO(d).slice(0, 7);
}

export function monthTitle(year, month) {
  return { name: MONTHS[month], year };
}

/** "Mon 2 Nov" */
export function formatDay(date) {
  return `${DAYS_SHORT[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`;
}

/** "Mon 2 – Fri 6 Nov"  /  "Fri 27 Nov – Fri 4 Dec" */
export function formatRange(checkIn, checkOut) {
  const sameMonth = checkIn.getUTCMonth() === checkOut.getUTCMonth()
    && checkIn.getUTCFullYear() === checkOut.getUTCFullYear();
  const start = sameMonth
    ? `${DAYS_SHORT[checkIn.getUTCDay()]} ${checkIn.getUTCDate()}`
    : formatDay(checkIn);
  return `${start} – ${formatDay(checkOut)}`;
}

/** Do the two stays share at least one night? (checkout day is free for the next guest) */
export function overlaps(aIn, aOut, bIn, bOut) {
  return aIn < bOut && aOut > bIn;
}

/**
 * Builds the 6-week (42 day) month grid, Monday first.
 * bookings: [{ BookingId, CheckIn: Date, CheckOut: Date, DisplayName, Initials, Colour, TextColour, ... }]
 */
export function buildMonthGrid(year, month, bookings, today = todayISO()) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const gridStart = addDays(first, -offset);
  const cells = [];

  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    const iso = toISO(date);
    const booking = bookings.find((b) => date >= b.CheckIn && date < b.CheckOut) || null;
    const col = i % 7;
    const cell = {
      iso,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month,
      isToday: iso === today,
      isPast: iso < today,
      booking,
      bar: null,
    };
    if (booking) {
      const isStart = iso === toISO(booking.CheckIn) || col === 0;
      const isEnd = iso === toISO(addDays(booking.CheckOut, -1)) || col === 6;
      // How many cells (in this week row) the bar runs for - lets the label spill across them.
      let span = 1;
      while (col + span < 7 && date.getTime() + span * DAY_MS < booking.CheckOut.getTime()) span++;
      cell.bar = { isStart, isEnd, showLabel: isStart, span };
    }
    cells.push(cell);
  }

  const weeks = [];
  for (let w = 0; w < 6; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
  return { gridStart, gridEnd: addDays(gridStart, 42), cells, weeks };
}

/** Free date ranges inside [from, to) that are at least one night long. */
export function freeRanges(from, to, bookings) {
  const sorted = [...bookings].sort((a, b) => a.CheckIn - b.CheckIn);
  const ranges = [];
  let cursor = from;
  for (const b of sorted) {
    if (b.CheckOut <= cursor) continue;
    if (b.CheckIn >= to) break;
    if (b.CheckIn > cursor) ranges.push({ start: cursor, end: b.CheckIn });
    if (b.CheckOut > cursor) cursor = b.CheckOut;
  }
  if (cursor < to) ranges.push({ start: cursor, end: to });
  return ranges.map((r) => ({ ...r, nights: nightsBetween(r.start, r.end) }));
}
